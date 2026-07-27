import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/halaman/[id].astro
var _id__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Id,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Id = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Id;
	const token = Astro.cookies.get("smkdh_token")?.value;
	if (!token) return Astro.redirect("/admin/login");
	const session = await verifyToken(token);
	if (!session) return Astro.redirect("/admin/login");
	const { id } = Astro.params;
	const isEdit = id && id !== "new";
	const item = isEdit ? await db.page.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/halaman?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			title: data.get("title")?.toString() || "",
			slug: data.get("slug")?.toString() || "",
			content: data.get("content")?.toString() || "",
			metaDesc: data.get("metaDesc")?.toString() || null,
			published: data.get("published") === "1"
		};
		if (isEdit) await db.page.update({
			where: { id },
			data: record
		});
		else await db.page.create({ data: record });
		return Astro.redirect("/admin/halaman?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Halaman" : "Tambah Halaman",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul *</label><input type="text" name="title"${addAttribute(item?.title || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Slug</label><input type="text" name="slug"${addAttribute(item?.slug || "", "value")} placeholder="profil"></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Konten (HTML)</label><textarea name="content" rows="14" style="font-family:monospace;font-size:13px;resize:vertical">${item?.content || ""}</textarea></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Meta Description</label><input type="text" name="metaDesc"${addAttribute(item?.metaDesc || "", "value")}></div><label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600"><input type="checkbox" name="published" value="1"${addAttribute(item?.published ?? false, "checked")} style="width:auto"> Publish</label></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/halaman" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/halaman/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/halaman/[id].astro";
var $$url = "/admin/halaman/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/halaman/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
