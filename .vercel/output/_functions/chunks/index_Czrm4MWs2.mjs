import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/pengguna/index.astro
var pengguna_exports = /* @__PURE__ */ __exportAll({
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
	if (session.role !== "superadmin") return Astro.redirect("/admin");
	const admins = await db.admin.findMany();
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": "Pengguna",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<div class="card" style="padding:0"><table><thead><tr><th>Username</th><th>Role</th><th style="width:80px"></th></tr></thead><tbody>${admins.map((a) => renderTemplate`<tr><td style="font-weight:600">${a.username}</td><td><span${addAttribute(`badge ${a.role === "superadmin" ? "badge-green" : "badge-gold"}`, "class")}>${a.role}</span></td><td>${a.username !== "admin" && renderTemplate`<form method="POST" action="/admin/pengguna/delete"><input type="hidden" name="id"${addAttribute(a.id, "value")}><button type="submit" class="btn btn-outline" style="padding:6px 10px;font-size:11px;color:#dc2626"><span class="material-symbols-outlined" style="font-size:16px">delete</span></button></form>`}</td></tr>`)}</tbody></table></div><p style="font-size:12px;color:#6f7a6e;margin-top:8px">Superadmin tidak bisa dihapus.</p>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengguna/index.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/pengguna/index.astro";
var $$url = "/admin/pengguna";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/pengguna/index@_@astro
var page = () => pengguna_exports;
//#endregion
export { page };
