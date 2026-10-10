const fs = require("fs")
const path = require("path")
const { NtExecutable, NtExecutableResource, Data, Resource } = require("resedit")

const file = path.join(__dirname, "dist", "win-unpacked", "Torpedo x Strike.exe")
const exe = NtExecutable.from(fs.readFileSync(file))
const res = NtExecutableResource.from(exe)

const groups = Resource.IconGroupEntry.fromEntries(res.entries)
const group = groups[0]
const iconFile = Data.IconFile.from(fs.readFileSync(path.join(__dirname, "icon.ico")))
Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  group.id,
  group.lang,
  iconFile.icons.map((item) => item.data)
)

const info = Resource.VersionInfo.fromEntries(res.entries)[0]
const lang = { lang: 1033, codepage: 1200 }
info.setFileVersion(2, 2, 0, 0, 1033)
info.setProductVersion(2, 2, 0, 0, 1033)
info.setStringValues(lang, {
  CompanyName: "Михаил Хонинев",
  FileDescription: "Torpedo x Strike",
  FileVersion: "2.2.0",
  InternalName: "Torpedo x Strike",
  LegalCopyright: "Демо на виртуальные кредиты",
  OriginalFilename: "Torpedo x Strike.exe",
  ProductName: "Torpedo x Strike",
  ProductVersion: "2.2.0",
})
info.outputToResourceEntries(res.entries)
res.outputResource(exe)
fs.writeFileSync(file, Buffer.from(exe.generate()))
