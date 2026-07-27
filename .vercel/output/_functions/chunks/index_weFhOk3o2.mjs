import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/testimoni/index.astro
var testimoni_exports = /* @__PURE__ */ __exportAll({
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
	const roleFilter = url.searchParams.get("role") || "";
	const page = parseInt(url.searchParams.get("page") || "1");
	const limit = 15;
	const where = {};
	if (search) where.name = { contains: search };
	if (roleFilter) where.role = roleFilter;
	const [testimonials, total] = await Promise.all([db.testimonial.findMany({
		where,
		orderBy: { createdAt: "desc" },
		skip: (page - 1) * limit,
		take: limit
	}), db.testimonial.count({ where })]);
	const totalPages = Math.ceil(total / limit);
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Testimoni",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><div style="display:flex;gap:10px;align-items:center"><form method="GET" style="display:flex;gap:8px"><input type="text" name="q"${addAttribute(search, "value")} placeholder="Cari nama..." style="width:200px"><select name="role" style="width:130px" onchange="this.form.submit()"><option value="">Semua Role</option>${[
		"Siswa",
		"Orang Tua",
		"Alumni",
		"Mitra"
	].map((r) => renderTemplate`<option${addAttribute(r, "value")}${addAttribute(roleFilter === r, "selected")}>${r}</option>`)}</select><button type="submit" class="btn btn-outline" style="padding:10px 14px">Cari</button></form></div><a href="/admin/testimoni/new" class="btn btn-primary"><span class="material-symbols-outlined">add</span> Tambah Testimoni</a></div><div class="card" style="padding:0"><table><thead><tr><th style="width:30%">Nama</th><th>Role</th><th>Konten</th><th>Status</th><th style="width:80px"></th></tr></thead><tbody>${testimonials.length === 0 ? renderTemplate`<tr><td colspan="5" style="text-align:center;padding:40px;color:#6f7a6e">Belum ada testimoni.</td></tr>` : testimonials.map((t) => renderTemplate`<tr><td style="font-weight:600">${t.name}</td><td><span class="badge badge-gray">${t.role}</span></td><td style="font-size:12px;color:#6f7a6e;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.content}</td><td>${t.verified ? renderTemplate`<span class="badge badge-green">Terverifikasi</span>` : renderTemplate`<span class="badge badge-gray">Belum</span>`}</td><td><div style="display:flex;gap:4px"><a${addAttribute(`/admin/testimoni/${t.id}`, "href")} class="btn btn-outline" style="padding:6px 10px;font-size:11px"><span class="material-symbols-outlined" style="font-size:16px">edit</span></a><form method="POST" action="/admin/testimoni/delete" style="display:inline"><input type="hidden" name="id"${addAttribute(t.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form></div></td></tr>`)}</tbody></table></div>${totalPages > 1 && renderTemplate`<div style="display:flex;justify-content:center;gap:6px;margin-top:20px">${Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => renderTemplate`<a${addAttribute(`?page=${p}&q=${search}&role=${roleFilter}`, "href")}${addAttribute(`btn ${p === page ? "btn-primary" : "btn-outline"}`, "class")} style="padding:8px 14px;font-size:13px">${p}</a>`)}</div>`}<p style="font-size:12px;color:#6f7a6e;margin-top:12px">Total: ${total} testimoni</p>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/testimoni/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/testimoni/index.astro";
var $$url = "/admin/testimoni";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/testimoni/index@_@astro
var page = () => testimoni_exports;
//#endregion
export { page };
