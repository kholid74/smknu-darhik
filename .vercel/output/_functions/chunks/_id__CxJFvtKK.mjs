import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/mitra/[id].astro
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
	const item = isEdit ? await db.partner.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/mitra?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			name: data.get("name")?.toString() || "",
			logoUrl: data.get("logoUrl")?.toString() || null,
			type: data.get("type")?.toString() || null,
			order: parseInt(data.get("order")?.toString() || "0") || 0
		};
		if (isEdit) await db.partner.update({
			where: { id },
			data: record
		});
		else await db.partner.create({ data: record });
		return Astro.redirect("/admin/mitra?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Mitra" : "Tambah Mitra",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama *</label><input type="text" name="name"${addAttribute(item?.name || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Logo</label><input type="url" name="logoUrl"${addAttribute(item?.logoUrl || "", "value")} placeholder="https://..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Tipe</label><select name="type"><option value="">-</option><option value="Industri"${addAttribute(item?.type === "Industri" || void 0, "selected")}>Industri</option><option value="Institusi"${addAttribute(item?.type === "Institusi" || void 0, "selected")}>Institusi</option><option value="Pemerintah"${addAttribute(item?.type === "Pemerintah" || void 0, "selected")}>Pemerintah</option></select></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Urutan</label><input type="number" name="order"${addAttribute(item?.order ?? 0, "value")}></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/mitra" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/mitra/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/mitra/[id].astro";
var $$url = "/admin/mitra/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/mitra/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
