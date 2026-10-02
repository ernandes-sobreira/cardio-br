#!/usr/bin/env python3
import base64, gzip, json, math, re
from pathlib import Path
import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

ROOT=Path(__file__).resolve().parents[2]
ASSET=ROOT/"v3"/"assets"
DATA=ROOT/"v3"/"data"
DATA.mkdir(parents=True,exist_ok=True)

def finite(v):
    try:
        x=float(v)
        return x if math.isfinite(x) else None
    except Exception:
        return None

def unpack():
    chunks=[]
    for p in sorted(ASSET.glob("data-gz-part-*.js")):
        m=re.search(r'push\("([A-Za-z0-9+/=]+)"\)',p.read_text(encoding="utf-8"))
        if not m: raise RuntimeError(f"Could not parse {p}")
        chunks.append(m.group(1))
    pack=json.loads(gzip.decompress(base64.b64decode("".join(chunks))).decode("utf-8"))
    df=pd.DataFrame(pack["mr"],columns=pack["mh"])
    df["Ano"]=pd.to_numeric(df["Ano"],errors="coerce")
    return pack,df

def fit_hac(x,y,log=False):
    x=np.asarray(x,dtype=float); y=np.asarray(y,dtype=float)
    if log:
        mask=y>0; x=x[mask]; y=np.log(y[mask])
    X=sm.add_constant(x)
    mod=sm.OLS(y,X).fit(cov_type="HAC",cov_kwds={"maxlags":1})
    slope=float(mod.params[1]); se=float(mod.bse[1])
    ci=(slope-1.96*se,slope+1.96*se)
    return mod,slope,ci

def one_trend(s):
    s=s.dropna()
    if len(s)<8: return None
    x=s.index.to_numpy(dtype=float); y=s.to_numpy(dtype=float)
    mod,slope,ci=fit_hac(x,y,False)
    lmod,lslope,lci=fit_hac(x,y,True)
    apc=(math.exp(lslope)-1)*100
    apc_lo=(math.exp(lci[0])-1)*100
    apc_hi=(math.exp(lci[1])-1)*100
    ts=stats.theilslopes(y,x,alpha=.95)
    pct=((y[-1]-y[0])/y[0]*100) if y[0]!=0 else None
    p=float(mod.pvalues[1])
    classification=("queda detectável" if slope<0 else "alta detectável") if p<.05 else "sem tendência detectável"
    return {
        "n":int(len(y)),"slope":finite(slope),"p":finite(p),
        "ci_low":finite(ci[0]),"ci_high":finite(ci[1]),
        "theil_sen":finite(ts.slope),
        "apc":finite(apc),"apc_low":finite(apc_lo),"apc_high":finite(apc_hi),
        "pct_change":finite(pct),"year_start":int(x[0]),"year_end":int(x[-1]),
        "r2":finite(mod.rsquared),"classificacao":classification
    }

def main():
    pack,df=unpack()
    regions=["Norte","Nordeste","Centro-Oeste","Sudeste","Sul"]
    scopes={"Brasil":df}
    for reg in regions:
        scopes[f"Região {reg}"]=df[df["Região"]==reg]

    result={}
    for scope_name,sdf in scopes.items():
        result[scope_name]={}
        for key,meta in pack["outcomes"].items():
            if key not in sdf.columns: continue
            vals=pd.to_numeric(sdf[key],errors="coerce")
            tmp=pd.DataFrame({"Ano":sdf["Ano"],"v":vals}).dropna()
            annual=tmp.groupby("Ano")["v"].mean().sort_index()
            t=one_trend(annual)
            if t:
                result[scope_name][key]=t

    (ASSET/"scope-trends-data.js").write_text(
        "window.CARDIOCLIMA_SCOPE_TRENDS="+json.dumps(result,ensure_ascii=False,separators=(",",":"))+";\n",
        encoding="utf-8"
    )

    health_meta={
        "packed_meta":pack.get("meta"),
        "rows":int(len(df)),
        "capitals":int(df["Capital"].nunique()) if "Capital" in df else None,
        "year_start":int(df["Ano"].min()),
        "year_end":int(df["Ano"].max()),
        "columns":list(df.columns),
        "outcomes":pack.get("outcomes")
    }
    (DATA/"health_metadata.json").write_text(json.dumps(health_meta,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"scopes":list(result),"health_meta":health_meta},ensure_ascii=False,indent=2))

if __name__=="__main__":
    main()
