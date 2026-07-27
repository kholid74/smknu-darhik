import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/galeri/[id].astro
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
	const item = isEdit ? await db.galleryImage.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/galeri?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			title: data.get("title")?.toString() || null,
			imageUrl: data.get("imageUrl")?.toString() || "",
			album: data.get("album")?.toString() || null
		};
		if (isEdit) await db.galleryImage.update({
			where: { id },
			data: record
		});
		else await db.galleryImage.create({ data: record });
		return Astro.redirect("/admin/galeri?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Foto" : "Tambah Foto",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul</label><input type="text" name="title"${addAttribute(item?.title || "", "value")} placeholder="Opsional"></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Gambar *</label><input type="url" name="imageUrl"${addAttribute(item?.imageUrl || "", "value")} placeholder="https://..." required></div>${item?.imageUrl && renderTemplate`<div style="margin-bottom:4px"><img${addAttribute(item.imageUrl, "src")} alt="Preview" style="max-width:200px;border-radius:8px;border:1px solid rgba(0,0,0,0.1)"></div>`}<div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Album</label><input type="text" name="album"${addAttribute(item?.album || "", "value")} placeholder="Kegiatan 2026"></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/galeri" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/galeri/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/galeri/[id].astro";
var $$url = "/admin/galeri/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/galeri/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
