import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/index.astro
var admin_exports = /* @__PURE__ */ __exportAll({
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
	const [articleCount, deptCount, teacherCount, achievementCount] = await Promise.all([
		db.article.count(),
		db.department.count(),
		db.teacher.count(),
		db.achievement.count()
	]);
	const stats = [
		{
			label: "Artikel",
			value: articleCount,
			icon: "article"
		},
		{
			label: "Jurusan",
			value: deptCount,
			icon: "school"
		},
		{
			label: "Guru & Staf",
			value: teacherCount,
			icon: "group"
		},
		{
			label: "Prestasi",
			value: achievementCount,
			icon: "emoji_events"
		}
	];
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Dashboard",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px">${stats.map((s) => renderTemplate`<div class="card" style="display:flex;align-items:center;gap:14px"><span class="material-symbols-outlined" style="font-size:32px;color:#1B7A3D;background:#e8f5e9;padding:12px;border-radius:12px">${s.icon}</span><div><div style="font-size:28px;font-weight:800">${s.value}</div><div style="font-size:13px;color:#6f7a6e">${s.label}</div></div></div>`)}</div><div class="card"><h3 style="font-size:16px;font-weight:700;margin-bottom:12px">Pintasan</h3><div style="display:flex;flex-wrap:wrap;gap:10px"><a href="/admin/artikel" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tulis Artikel</a><a href="/admin/galeri" class="btn btn-outline"><span class="material-symbols-outlined">add_photo_alternate</span> Upload Foto</a><a href="/admin/pengaturan" class="btn btn-outline"><span class="material-symbols-outlined">settings</span> Pengaturan</a><a href="/" target="_blank" class="btn btn-outline"><span class="material-symbols-outlined">open_in_new</span> Lihat Website</a></div></div>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/index.astro";
var $$url = "/admin";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/index@_@astro
var page = () => admin_exports;
//#endregion
export { page };
