import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/halaman/index.astro
var halaman_exports = /* @__PURE__ */ __exportAll({
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
	const pages = await db.page.findMany({ orderBy: { updatedAt: "desc" } });
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Halaman Statis",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="font-size:18px;font-weight:800">Halaman Statis</h2><a href="/admin/halaman/new" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tambah</a></div><div class="card" style="padding:0"><table><thead><tr><th>Judul</th><th>Slug</th><th>Status</th><th style="width:80px"></th></tr></thead><tbody>${pages.length === 0 ? renderTemplate`<tr><td colspan="4" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada halaman.</td></tr>` : pages.map((p) => renderTemplate`<tr><td style="font-weight:600">${p.title}</td><td style="font-family:monospace;font-size:12px">${p.slug}</td><td><span${addAttribute(`badge ${p.published ? "badge-green" : "badge-gray"}`, "class")}>${p.published ? "Publish" : "Draft"}</span></td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/halaman/${p.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/halaman/delete"><input type="hidden" name="id"${addAttribute(p.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/halaman/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/halaman/index.astro";
var $$url = "/admin/halaman";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/halaman/index@_@astro
var page = () => halaman_exports;
//#endregion
export { page };
