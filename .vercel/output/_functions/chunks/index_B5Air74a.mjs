import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/jurusan/index.astro
var jurusan_exports = /* @__PURE__ */ __exportAll({
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
	const departments = await db.department.findMany({ orderBy: { order: "asc" } });
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Jurusan",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="font-size:18px;font-weight:800">Jurusan</h2></div><div class="card" style="padding:0"><table><thead><tr><th>Icon</th><th>Nama</th><th>Slug</th><th style="width:80px"></th></tr></thead><tbody>${departments.length === 0 ? renderTemplate`<tr><td colspan="4" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada jurusan.</td></tr>` : departments.map((d) => renderTemplate`<tr><td>${d.icon ? renderTemplate`<span class="material-symbols-outlined">${d.icon}</span>` : "-"}</td><td style="font-weight:600">${d.name}</td><td style="font-family:monospace;font-size:12px">${d.slug}</td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/jurusan/${d.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/jurusan/delete"><input type="hidden" name="id"${addAttribute(d.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/jurusan/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/jurusan/index.astro";
var $$url = "/admin/jurusan";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/jurusan/index@_@astro
var page = () => jurusan_exports;
//#endregion
export { page };
