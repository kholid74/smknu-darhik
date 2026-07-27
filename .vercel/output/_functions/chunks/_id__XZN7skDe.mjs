import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/jurusan/[id].astro
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
	const item = isEdit ? await db.department.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/jurusan?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			name: data.get("name")?.toString() || "",
			slug: data.get("slug")?.toString() || "",
			icon: data.get("icon")?.toString() || null,
			description: data.get("description")?.toString() || "",
			kompetensi: data.get("kompetensi")?.toString() || "",
			karir: data.get("karir")?.toString() || "",
			imageUrl: data.get("imageUrl")?.toString() || null,
			order: parseInt(data.get("order")?.toString() || "0")
		};
		if (isEdit) await db.department.update({
			where: { id },
			data: record
		});
		else await db.department.create({ data: record });
		return Astro.redirect("/admin/jurusan?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Jurusan" : "Tambah Jurusan",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama *</label><input type="text" name="name"${addAttribute(item?.name || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Slug</label><input type="text" name="slug"${addAttribute(item?.slug || "", "value")} placeholder="perbankan-syariah"></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Icon</label><input type="text" name="icon"${addAttribute(item?.icon || "", "value")} placeholder="school"></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Deskripsi</label><textarea name="description" rows="5" style="font-family:monospace;font-size:13px;resize:vertical">${item?.description || ""}</textarea></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kompetensi (JSON)</label><textarea name="kompetensi" rows="5" style="font-family:monospace;font-size:13px;resize:vertical">${item?.kompetensi || ""}</textarea></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Karir (JSON)</label><textarea name="karir" rows="5" style="font-family:monospace;font-size:13px;resize:vertical">${item?.karir || ""}</textarea></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Image URL</label><input type="text" name="imageUrl"${addAttribute(item?.imageUrl || "", "value")} placeholder="https://..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Order</label><input type="number" name="order"${addAttribute(item?.order ?? 0, "value")} style="width:80px"></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/jurusan" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/jurusan/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/jurusan/[id].astro";
var $$url = "/admin/jurusan/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/jurusan/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
