#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import math
import re
import urllib.request
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "v3" / "data"
ASSET_DIR = ROOT / "v3" / "assets"
DATA_DIR.mkdir(parents=True, exist_ok=True)
ASSET_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_URL = "https://zenodo.org/records/16374139/files/pm25_mean_mean.parquet?download=1"
SOURCE_MD5 = "bb4031181cf7fab6c74a3eedae9ce284"
SOURCE_DOI = "10.5281/zenodo.16374139"
PARQUET = ROOT / ".pm25_mean_mean.parquet"

CAPITALS = {
    1200401: ("Rio Branco","AC","Norte"),
    2704302: ("Maceió","AL","Nordeste"),
    1600303: ("Macapá","AP","Norte"),
    1302603: ("Manaus","AM","Norte"),
    2927408: ("Salvador","BA","Nordeste"),
    2304400: ("Fortaleza","CE","Nordeste"),
    5300108: ("Brasília","DF","Centro-Oeste"),
    3205309: ("Vitória","ES","Sudeste"),
    5208707: ("Goiânia","GO","Centro-Oeste"),
    2111300: ("São Luís","MA","Nordeste"),
    5103403: ("Cuiabá","MT","Centro-Oeste"),
    5002704: ("Campo Grande","MS","Centro-Oeste"),
    3106200: ("Belo Horizonte","MG","Sudeste"),
    1501402: ("Belém","PA","Norte"),
    2507507: ("João Pessoa","PB","Nordeste"),
    4106902: ("Curitiba","PR","Sul"),
    2611606: ("Recife","PE","Nordeste"),
    2211001: ("Teresina","PI","Nordeste"),
    3304557: ("Rio de Janeiro","RJ","Sudeste"),
    2408102: ("Natal","RN","Nordeste"),
    4314902: ("Porto Alegre","RS","Sul"),
    1100205: ("Porto Velho","RO","Norte"),
    1400100: ("Boa Vista","RR","Norte"),
    4205407: ("Florianópolis","SC","Sul"),
    3550308: ("São Paulo","SP","Sudeste"),
    2800308: ("Aracaju","SE","Nordeste"),
    1721000: ("Palmas","TO","Norte"),
}

EXPOSURES = {
    "pm25_media": "PM2,5 média anual (µg/m³)",
    "pm25_p95": "PM2,5 P95 diário (µg/m³)",
    "pm25_p99": "PM2,5 P99 diário (µg/m³)",
    "dias_acima_15_pct": "Dias > 15 µg/m³ (%)",
    "dias_acima_25_pct": "Dias > 25 µg/m³ (%)",
}

def download():
    print("Downloading source parquet...")
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent":"cardio-br-data-builder/1.0"})
    with urllib.request.urlopen(req, timeout=180) as r, open(PARQUET, "wb") as w:
        while True:
            chunk = r.read(1024 * 1024 * 8)
            if not chunk:
                break
            w.write(chunk)
    md5 = hashlib.md5(PARQUET.read_bytes()).hexdigest()
    if md5 != SOURCE_MD5:
        raise RuntimeError(f"MD5 mismatch: {md5} != {SOURCE_MD5}")
    print("Source verified:", md5)

def build_pm25():
    codes = ",".join(str(x) for x in CAPITALS)
    con = duckdb.connect()
    q_daily = f"""
      SELECT CAST(code_muni AS BIGINT) AS code_muni,
             CAST(date AS DATE) AS date,
             CAST(value AS DOUBLE) AS pm25
      FROM read_parquet('{PARQUET.as_posix()}')
      WHERE CAST(code_muni AS BIGINT) IN ({codes})
        AND date >= DATE '2008-01-01'
        AND date <= DATE '2024-12-31'
      ORDER BY code_muni, date
    """
    daily = con.execute(q_daily).df()
    if daily.empty:
        raise RuntimeError("No PM2.5 rows extracted")
    if daily["code_muni"].nunique() != 27:
        raise RuntimeError(f"Expected 27 capitals; got {daily['code_muni'].nunique()}")

    daily["Capital"] = daily["code_muni"].map(lambda x: CAPITALS[int(x)][0])
    daily["UF"] = daily["code_muni"].map(lambda x: CAPITALS[int(x)][1])
    daily["Região"] = daily["code_muni"].map(lambda x: CAPITALS[int(x)][2])
    daily["Ano"] = pd.to_datetime(daily["date"]).dt.year
    daily = daily[["code_muni","Capital","UF","Região","date","Ano","pm25"]]
    daily.to_csv(DATA_DIR / "pm25_capitais_diario_2008_2024.csv", index=False)

    annual = (daily.groupby(["code_muni","Capital","UF","Região","Ano"], as_index=False)
        .agg(
            n_dias=("pm25","size"),
            pm25_media=("pm25","mean"),
            pm25_mediana=("pm25","median"),
            pm25_p95=("pm25",lambda s: s.quantile(.95)),
            pm25_p99=("pm25",lambda s: s.quantile(.99)),
            pm25_max=("pm25","max"),
            dias_acima_15_pct=("pm25",lambda s: (s > 15).mean()*100),
            dias_acima_25_pct=("pm25",lambda s: (s > 25).mean()*100),
        ))
    for col in ["pm25_media","pm25_mediana","pm25_p95","pm25_p99","pm25_max","dias_acima_15_pct","dias_acima_25_pct"]:
        annual[col] = annual[col].round(3)
    annual.to_csv(DATA_DIR / "pm25_capitais_anual_2008_2024.csv", index=False)
    return daily, annual

def unpack_health():
    chunks=[]
    for p in sorted(ASSET_DIR.glob("data-gz-part-*.js")):
        m=re.search(r'push\("([A-Za-z0-9+/=]+)"\)', p.read_text(encoding="utf-8"))
        if not m:
            raise RuntimeError(f"Could not parse {p}")
        chunks.append(m.group(1))
    raw=gzip.decompress(base64.b64decode("".join(chunks)))
    pack=json.loads(raw.decode("utf-8"))
    health=pd.DataFrame(pack["mr"], columns=pack["mh"])
    health["Ano"]=pd.to_numeric(health["Ano"], errors="coerce").astype("Int64")
    return pack, health

def finite(v):
    if v is None:
        return None
    try:
        x=float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None

def model_fe(df, xcol, exclude=False):
    d=df.copy()
    if exclude:
        d=d[~d["Ano"].isin([2020,2021])]
    d=d.dropna(subset=["y",xcol,"Capital","Ano"]).copy()
    d["Ano"] = pd.to_numeric(d["Ano"], errors="raise").astype(int)
    d["Capital"] = d["Capital"].astype(str)
    d["y"] = pd.to_numeric(d["y"], errors="raise").astype(float)
    d[xcol] = pd.to_numeric(d[xcol], errors="raise").astype(float)
    if len(d) < 60 or d["Capital"].nunique() < 10:
        return None
    try:
        mod=smf.ols(f"y ~ {xcol} + C(Capital) + C(Ano)", data=d).fit(
            cov_type="cluster", cov_kwds={"groups":d["Capital"]}
        )
        coef=mod.params[xcol]
        se=mod.bse[xcol]
        return {
            "n": int(mod.nobs),
            "capitals": int(d["Capital"].nunique()),
            "coef": finite(coef),
            "se": finite(se),
            "ci_low": finite(coef-1.96*se),
            "ci_high": finite(coef+1.96*se),
            "p": finite(mod.pvalues[xcol]),
            "r2": finite(mod.rsquared),
        }
    except Exception as e:
        print("FE failed", xcol, e)
        return None

def model_diff(df, xcol):
    d=df.sort_values(["Capital","Ano"]).copy()
    d["dy"]=d.groupby("Capital")["y"].diff()
    d["dx"]=d.groupby("Capital")[xcol].diff()
    d=d.dropna(subset=["dy","dx","Capital","Ano"]).copy()
    d["Ano"] = pd.to_numeric(d["Ano"], errors="raise").astype(int)
    d["Capital"] = d["Capital"].astype(str)
    d["dy"] = pd.to_numeric(d["dy"], errors="raise").astype(float)
    d["dx"] = pd.to_numeric(d["dx"], errors="raise").astype(float)
    if len(d) < 50 or d["Capital"].nunique() < 10:
        return None
    try:
        mod=smf.ols("dy ~ dx + C(Ano)", data=d).fit(
            cov_type="cluster", cov_kwds={"groups":d["Capital"]}
        )
        coef=mod.params["dx"]
        se=mod.bse["dx"]
        return {
            "n": int(mod.nobs),
            "capitals": int(d["Capital"].nunique()),
            "coef": finite(coef),
            "se": finite(se),
            "ci_low": finite(coef-1.96*se),
            "ci_high": finite(coef+1.96*se),
            "p": finite(mod.pvalues["dx"]),
            "r2": finite(mod.rsquared),
        }
    except Exception as e:
        print("Diff failed", xcol, e)
        return None

def build_stats(pack, health, annual):
    merged=health.merge(annual, on=["Capital","Ano"], how="inner", suffixes=("","_pm"))
    outcomes={}
    for key, meta in pack["outcomes"].items():
        if key not in merged.columns:
            continue
        y=pd.to_numeric(merged[key], errors="coerce")
        if y.notna().sum() < 60:
            continue
        outcomes[key]={
            "label": meta.get("label", key),
            "group": meta.get("group", "Outro")
        }

    stats_out={}
    for xcol, xlabel in EXPOSURES.items():
        stats_out[xcol]={"label":xlabel,"outcomes":{}}
        for key, meta in outcomes.items():
            d=merged[["Capital","Ano",xcol,key]].copy()
            d["y"]=pd.to_numeric(d[key], errors="coerce")
            d=d.dropna(subset=["y",xcol])
            if len(d) < 60:
                continue
            try:
                pr=stats.pearsonr(d[xcol], d["y"])
                sr=stats.spearmanr(d[xcol], d["y"])
                pearson={"r":finite(pr.statistic),"p":finite(pr.pvalue)}
                spearman={"rho":finite(sr.statistic),"p":finite(sr.pvalue)}
            except Exception:
                pearson={"r":None,"p":None}; spearman={"rho":None,"p":None}
            stats_out[xcol]["outcomes"][key]={
                **meta,
                "n":int(len(d)),
                "capitals":int(d["Capital"].nunique()),
                "pearson":pearson,
                "spearman":spearman,
                "fixed_effects":{
                    "full":model_fe(d,xcol,False),
                    "exclude_2020_2021":model_fe(d,xcol,True),
                    "first_difference":model_diff(d,xcol),
                }
            }

    payload={
        "meta":{
            "source":"CAMS global reanalysis (EAC4), zonal statistics for Brazilian municipalities",
            "publisher":"Zenodo / Fundação Oswaldo Cruz",
            "doi":SOURCE_DOI,
            "period":"2008-2024",
            "n_capitals":27,
            "daily_rows":int(len(annual)*0 + 27*0),
            "annual_rows":int(len(annual)),
            "note":"2025 omitted from annual analyses because the available PM2.5 record is partial (Jan-Aug)."
        },
        "exposures":EXPOSURES,
        "outcomes":outcomes,
        "annual":annual.to_dict(orient="records"),
        "stats":stats_out
    }
    return payload

def main():
    download()
    daily, annual=build_pm25()
    pack, health=unpack_health()
    payload=build_stats(pack, health, annual)
    payload["meta"]["daily_rows"]=int(len(daily))
    out=ASSET_DIR / "pm25-capitais-data.js"
    out.write_text(
        "window.CARDIOCLIMA_PM25_ALL="+json.dumps(payload, ensure_ascii=False, separators=(",",":"))+";\n",
        encoding="utf-8"
    )
    meta={
        "source_url":SOURCE_URL,
        "source_md5":SOURCE_MD5,
        "source_doi":SOURCE_DOI,
        "period":"2008-2024",
        "capitals":27,
        "daily_rows":int(len(daily)),
        "annual_rows":int(len(annual)),
        "generated_files":[
            "v3/data/pm25_capitais_diario_2008_2024.csv",
            "v3/data/pm25_capitais_anual_2008_2024.csv",
            "v3/assets/pm25-capitais-data.js"
        ]
    }
    (DATA_DIR / "pm25_capitais_metadata.json").write_text(
        json.dumps(meta,ensure_ascii=False,indent=2),encoding="utf-8"
    )
    PARQUET.unlink(missing_ok=True)
    print(json.dumps(meta,ensure_ascii=False,indent=2))

if __name__ == "__main__":
    main()
