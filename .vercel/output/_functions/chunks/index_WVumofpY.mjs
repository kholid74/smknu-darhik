import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/guru/index.astro
var guru_exports = /* @__PURE__ */ __exportAll({
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
	const teachers = await db.teacher.findMany({ orderBy: { order: "asc" } });
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Guru &amp; Staf",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="font-size:18px;font-weight:800">Guru &amp; Staf</h2><a href="/admin/guru/new" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tambah</a></div><div class="card" style="padding:0"><table><thead><tr><th>Foto</th><th>Nama</th><th>Jabatan</th><th>Level</th><th style="width:80px"></th></tr></thead><tbody>${teachers.length === 0 ? renderTemplate`<tr><td colspan="5" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada guru/staf.</td></tr>` : teachers.map((t) => renderTemplate`<tr><td>${t.photoUrl ? renderTemplate`<img${addAttribute(t.photoUrl, "src")} alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : "-"}</td><td style="font-weight:600">${t.name}${t.title ? `, ${t.title}` : ""}</td><td style="font-size:13px">${t.position}</td><td><span class="badge badge-gray">${t.level}</span></td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/guru/${t.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/guru/delete"><input type="hidden" name="id"${addAttribute(t.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/guru/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/guru/index.astro";
var $$url = "/admin/guru";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/guru/index@_@astro
var page = () => guru_exports;
//#endregion
export { page };
