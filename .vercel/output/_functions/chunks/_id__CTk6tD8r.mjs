import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/ekskul/[id].astro
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
	const item = isEdit ? await db.extracurricular.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/ekskul?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			name: data.get("name")?.toString() || "",
			description: data.get("description")?.toString() || null,
			imageUrl: data.get("imageUrl")?.toString() || null
		};
		if (isEdit) await db.extracurricular.update({
			where: { id },
			data: record
		});
		else await db.extracurricular.create({ data: record });
		return Astro.redirect("/admin/ekskul?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Ekstrakurikuler" : "Tambah Ekstrakurikuler",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama *</label><input type="text" name="name"${addAttribute(item?.name || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Deskripsi</label><textarea name="description" rows="4" style="resize:vertical">${item?.description || ""}</textarea></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Gambar</label><input type="url" name="imageUrl"${addAttribute(item?.imageUrl || "", "value")} placeholder="https://..."></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/ekskul" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/ekskul/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/ekskul/[id].astro";
var $$url = "/admin/ekskul/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/ekskul/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
