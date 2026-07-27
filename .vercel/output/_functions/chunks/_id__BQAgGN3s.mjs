import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/fasilitas/[id].astro
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
	let facility = isEdit ? await db.facility.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !facility) return Astro.redirect("/admin/fasilitas?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const name = data.get("name")?.toString() || "";
		const description = data.get("description")?.toString() || null;
		const icon = data.get("icon")?.toString() || null;
		const imageUrl = data.get("imageUrl")?.toString() || null;
		const order = parseInt(data.get("order")?.toString() || "0");
		if (isEdit) await db.facility.update({
			where: { id },
			data: {
				name,
				description,
				icon,
				imageUrl,
				order
			}
		});
		else await db.facility.create({ data: {
			name,
			description,
			icon,
			imageUrl,
			order
		} });
		return Astro.redirect("/admin/fasilitas?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Fasilitas" : "Tambah Fasilitas",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST"><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama Fasilitas *</label><input type="text" name="name"${addAttribute(facility?.name || "", "value")} required placeholder="Laboratorium Komputer..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Urutan</label><input type="number" name="order"${addAttribute(facility?.order ?? 0, "value")} min="0" style="width:80px"></div></div></div><div class="card" style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Deskripsi</label><textarea name="description" rows="4" style="resize:vertical" placeholder="Deskripsi fasilitas...">${facility?.description || ""}</textarea></div><div class="card" style="margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Icon (Material Symbol)</label><input type="text" name="icon"${addAttribute(facility?.icon || "", "value")} placeholder="computer, science, sports_soccer..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Gambar</label><input type="text" name="imageUrl"${addAttribute(facility?.imageUrl || "", "value")} placeholder="https://... atau /uploads/..."></div></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/fasilitas" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/fasilitas/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/fasilitas/[id].astro";
var $$url = "/admin/fasilitas/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/fasilitas/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
