import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/artikel/index.astro
var artikel_exports = /* @__PURE__ */ __exportAll({
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
	const filter = url.searchParams.get("filter") || "";
	const page = parseInt(url.searchParams.get("page") || "1");
	const limit = 15;
	const where = {};
	if (search) where.title = { contains: search };
	if (filter) where.category = filter;
	const [articles, total] = await Promise.all([db.article.findMany({
		where,
		orderBy: { createdAt: "desc" },
		skip: (page - 1) * limit,
		take: limit
	}), db.article.count({ where })]);
	const totalPages = Math.ceil(total / limit);
	const catBadge = {
		Prestasi: "badge-green",
		Keagamaan: "badge-gold",
		Akademik: "badge-green",
		Ekstrakurikuler: "badge-gold",
		PPDB: "badge-green"
	};
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Artikel",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="display:flex;gap:10px;align-items:center"><form method="GET" style="display:flex;gap:8px"><input type="text" name="q"${addAttribute(search, "value")} placeholder="Cari judul..." style="width:240px"><select name="filter" style="width:150px" onchange="this.form.submit()"><option value="">Semua Kategori</option>${[
		"Prestasi",
		"Keagamaan",
		"Akademik",
		"Ekstrakurikuler",
		"PPDB"
	].map((c) => renderTemplate`<option${addAttribute(c, "value")}${addAttribute(filter === c, "selected")}>${c}</option>`)}</select><button type="submit" class="btn btn-outline" style="padding:10px 14px">Cari</button></form></div><a href="/admin/artikel/new" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tulis Artikel</a></div><div class="card" style="padding:0"><table><thead><tr><th style="width:45%">Judul</th><th>Kategori</th><th>Status</th><th>Tanggal</th><th style="width:80px"></th></tr></thead><tbody>${articles.length === 0 ? renderTemplate`<tr><td colspan="5" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada artikel.</td></tr>` : articles.map((a) => renderTemplate`<tr><td style="font-weight:600">${a.title}${a.featured && renderTemplate`<span class="badge badge-gold" style="margin-left:6px">Featured</span>`}</td><td><span${addAttribute(`badge ${catBadge[a.category] || "badge-gray"}`, "class")}>${a.category}</span></td><td><span${addAttribute(`badge ${a.published ? "badge-green" : "badge-gray"}`, "class")}>${a.published ? "Publish" : "Draft"}</span></td><td style="font-size:12px;color:#6f7a6e">${new Date(a.createdAt).toLocaleDateString("id")}</td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/artikel/${a.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/artikel/delete" style="display:inline"><input type="hidden" name="id"${addAttribute(a.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>${totalPages > 1 && renderTemplate`<div style="display:flex;justify-content:center;gap:6px;margin-top:20px">${Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => renderTemplate`<a${addAttribute(`?page=${p}&q=${search}&filter=${filter}`, "href")}${addAttribute(`btn ${p === page ? "btn-primary" : "btn-outline"}`, "class")} style="padding:8px 14px;font-size:13px">${p}</a>`)}</div>`}<p style="font-size:12px;color:#6f7a6e;margin-top:12px">Total: ${total} artikel</p>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/artikel/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/artikel/index.astro";
var $$url = "/admin/artikel";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/artikel/index@_@astro
var page = () => artikel_exports;
//#endregion
export { page };
