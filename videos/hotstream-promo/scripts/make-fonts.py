# Subset macOS system CJK fonts to exactly the characters used in index.html (local render only).
import re, sys
from fontTools.ttLib import TTCollection
from fontTools import subset

html = open("index.html", encoding="utf-8").read()
chars = set(html) | set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ·，。、：；！？“”（）/-—_.+&@%")
text = "".join(sorted(c for c in chars if c.isprintable()))
A = "/System/Library/AssetsV2/com_apple_MobileAsset_Font7"
jobs = [
    (f"{A}/f7f6b250e97c182e68ac53a2b359ec44548878b9.asset/AssetData/Lantinghei.ttc", 2, "assets/fonts/hs-heavy.woff"),
    (f"{A}/3419f2a427639ad8c8e139149a287865a90fa17e.asset/AssetData/PingFang.ttc", 3, "assets/fonts/hs-regular.woff"),
    (f"{A}/3419f2a427639ad8c8e139149a287865a90fa17e.asset/AssetData/PingFang.ttc", 11, "assets/fonts/hs-semibold.woff"),
]
for path, idx, out in jobs:
    font = TTCollection(path).fonts[idx]
    opts = subset.Options()
    opts.flavor = "woff"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    font.flavor = "woff"
    font.save(out)
    print(out, font["name"].getDebugName(4), len(text), "chars")
