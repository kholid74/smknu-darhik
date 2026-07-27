import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/pengaturan/index.astro
var pengaturan_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Index,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Index = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Index;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return Astro.redirect("/admin/login");
	const session = await verifyToken(token);
	if (!session) return Astro.redirect("/admin/login");
	const settings = await db.setting.findFirst({ where: { id: "main" } }) || {};
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		await db.setting.upsert({
			where: { id: "main" },
			update: {
				siteName: data.get("siteName")?.toString() || "",
				tagline: data.get("tagline")?.toString() || "",
				address: data.get("address")?.toString() || "",
				phone: data.get("phone")?.toString() || "",
				email: data.get("email")?.toString() || "",
				wa: data.get("wa")?.toString() || "",
				instagram: data.get("instagram")?.toString() || "",
				facebook: data.get("facebook")?.toString() || "",
				tiktok: data.get("tiktok")?.toString() || "",
				youtube: data.get("youtube")?.toString() || ""
			},
			create: { id: "main" }
		});
		return Astro.redirect("/admin/pengaturan");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Pengaturan",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="margin-bottom:16px"><h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Informasi Sekolah</h3>${[
		{
			n: "siteName",
			l: "Nama Sekolah"
		},
		{
			n: "tagline",
			l: "Tagline"
		},
		{
			n: "address",
			l: "Alamat"
		},
		{
			n: "phone",
			l: "Telepon"
		},
		{
			n: "email",
			l: "Email"
		},
		{
			n: "wa",
			l: "WhatsApp (628...)"
		}
	].map((f) => renderTemplate`<div style="margin-bottom:10px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:3px">${f.l}</label><input type="text"${addAttribute(f.n, "name")}${addAttribute(settings[f.n] || "", "value")}></div>`)}</div><div class="card" style="margin-bottom:16px"><h3 style="font-size:15px;font-weight:700;margin-bottom:14px">Media Sosial</h3>${[
		{
			n: "instagram",
			l: "Instagram"
		},
		{
			n: "facebook",
			l: "Facebook"
		},
		{
			n: "tiktok",
			l: "TikTok"
		},
		{
			n: "youtube",
			l: "YouTube (@channel)"
		}
	].map((f) => renderTemplate`<div style="margin-bottom:10px"><label style="display:block;font-size:13px;font-weight:600;margin-bottom:3px">${f.l}</label><input type="text"${addAttribute(f.n, "name")}${addAttribute(settings[f.n] || "", "value")}></div>`)}</div><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan Pengaturan</button></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengaturan/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengaturan/index.astro";
var $$url = "/admin/pengaturan";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/pengaturan/index@_@astro
var page = () => pengaturan_exports;
//#endregion
export { page };
