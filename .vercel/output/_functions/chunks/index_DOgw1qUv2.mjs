import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/prestasi/index.astro
var prestasi_exports = /* @__PURE__ */ __exportAll({
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
	const url = new URL(Astro.request.url);
	const search = url.searchParams.get("q") || "";
	const levelFilter = url.searchParams.get("level") || "";
	const categoryFilter = url.searchParams.get("category") || "";
	const page = parseInt(url.searchParams.get("page") || "1");
	const limit = 15;
	const where = {};
	if (search) where.title = { contains: search };
	if (levelFilter) where.level = levelFilter;
	if (categoryFilter) where.category = categoryFilter;
	const [achievements, total] = await Promise.all([db.achievement.findMany({
		where,
		orderBy: { order: "asc" },
		skip: (page - 1) * limit,
		take: limit
	}), db.achievement.count({ where })]);
	const totalPages = Math.ceil(total / limit);
	const levelBadge = {
		Kabupaten: "badge-green",
		Provinsi: "badge-blue",
		Nasional: "badge-gold",
		Internasional: "badge-red"
	};
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Prestasi",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="display:flex;gap:10px;align-items:center"><form method="GET" style="display:flex;gap:8px"><input type="text" name="q"${addAttribute(search, "value")} placeholder="Cari judul..." style="width:200px"><select name="level" style="width:130px" onchange="this.form.submit()"><option value="">Semua Level</option>${[
		"Kabupaten",
		"Provinsi",
		"Nasional",
		"Internasional"
	].map((l) => renderTemplate`<option${addAttribute(l, "value")}${addAttribute(levelFilter === l, "selected")}>${l}</option>`)}</select><select name="category" style="width:140px" onchange="this.form.submit()"><option value="">Semua Kategori</option>${[
		"Akademik",
		"Non-Akademik",
		"Keagamaan"
	].map((c) => renderTemplate`<option${addAttribute(c, "value")}${addAttribute(categoryFilter === c, "selected")}>${c}</option>`)}</select><button type="submit" class="btn btn-outline" style="padding:10px 14px">Cari</button></form></div><a href="/admin/prestasi/new" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tambah Prestasi</a></div><div class="card" style="padding:0"><table><thead><tr><th style="width:35%">Judul</th><th>Level</th><th>Kategori</th><th>Tahun</th><th>Siswa</th><th style="width:80px"></th></tr></thead><tbody>${achievements.length === 0 ? renderTemplate`<tr><td colspan="6" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada prestasi.</td></tr>` : achievements.map((a) => renderTemplate`<tr><td style="font-weight:600">${a.title}${a.featured && renderTemplate`<span class="badge badge-gold" style="margin-left:6px">Featured</span>`}</td><td><span${addAttribute(`badge ${levelBadge[a.level] || "badge-gray"}`, "class")}>${a.level}</span></td><td><span class="badge badge-gray">${a.category || "-"}</span></td><td style="font-size:12px">${a.year}</td><td style="font-size:12px;color:#6f7a6e">${a.student || "-"}</td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/prestasi/${a.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/prestasi/delete" style="display:inline"><input type="hidden" name="id"${addAttribute(a.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>${totalPages > 1 && renderTemplate`<div style="display:flex;justify-content:center;gap:6px;margin-top:20px">${Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => renderTemplate`<a${addAttribute(`?page=${p}&q=${search}&level=${levelFilter}&category=${categoryFilter}`, "href")}${addAttribute(`btn ${p === page ? "btn-primary" : "btn-outline"}`, "class")} style="padding:8px 14px;font-size:13px">${p}</a>`)}</div>`}<p style="font-size:12px;color:#6f7a6e;margin-top:12px">Total: ${total} prestasi</p>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/prestasi/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/prestasi/index.astro";
var $$url = "/admin/prestasi";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/prestasi/index@_@astro
var page = () => prestasi_exports;
//#endregion
export { page };
