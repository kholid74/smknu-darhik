import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/prestasi/[id].astro
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
	let achievement = isEdit ? await db.achievement.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !achievement) return Astro.redirect("/admin/prestasi?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const title = data.get("title")?.toString() || "";
		const level = data.get("level")?.toString() || "Kabupaten";
		const year = data.get("year")?.toString() || "";
		const category = data.get("category")?.toString() || null;
		const student = data.get("student")?.toString() || null;
		const description = data.get("description")?.toString() || null;
		const imageUrl = data.get("imageUrl")?.toString() || null;
		const order = parseInt(data.get("order")?.toString() || "0");
		const featured = data.get("featured") === "1";
		if (isEdit) await db.achievement.update({
			where: { id },
			data: {
				title,
				level,
				year,
				category,
				student,
				description,
				imageUrl,
				order,
				featured
			}
		});
		else await db.achievement.create({ data: {
			title,
			level,
			year,
			category,
			student,
			description,
			imageUrl,
			order,
			featured
		} });
		return Astro.redirect("/admin/prestasi?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Prestasi" : "Tambah Prestasi",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST"><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Judul Prestasi *</label><input type="text" name="title"${addAttribute(achievement?.title || "", "value")} required placeholder="Juara 1 Lomba..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Tahun *</label><input type="text" name="year"${addAttribute(achievement?.year || "", "value")} required placeholder="2025"></div></div></div><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Level *</label><select name="level">${[
		"Kabupaten",
		"Provinsi",
		"Nasional",
		"Internasional"
	].map((l) => renderTemplate`<option${addAttribute(l, "value")}${addAttribute((achievement?.level || "Kabupaten") === l, "selected")}>${l}</option>`)}</select></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Kategori</label><select name="category"><option value="">- Pilih Kategori -</option>${[
		"Akademik",
		"Non-Akademik",
		"Keagamaan"
	].map((c) => renderTemplate`<option${addAttribute(c, "value")}${addAttribute(achievement?.category === c, "selected")}>${c}</option>`)}</select></div></div><div style="margin-top:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama Siswa/Tim</label><input type="text" name="student"${addAttribute(achievement?.student || "", "value")} placeholder="Nama siswa atau tim..."></div></div><div class="card" style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Deskripsi</label><textarea name="description" rows="4" style="resize:vertical" placeholder="Deskripsi prestasi...">${achievement?.description || ""}</textarea></div><div class="card" style="margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">URL Gambar</label><input type="text" name="imageUrl"${addAttribute(achievement?.imageUrl || "", "value")} placeholder="https://... atau /uploads/..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Urutan (Order)</label><input type="number" name="order"${addAttribute(achievement?.order ?? 0, "value")} min="0"></div><div style="display:flex;align-items:flex-end;padding-bottom:4px"><label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;cursor:pointer"><input type="checkbox" name="featured" value="1"${addAttribute(achievement?.featured ?? false, "checked")} style="width:auto"> Featured</label></div></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/prestasi" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/prestasi/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/prestasi/[id].astro";
var $$url = "/admin/prestasi/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/prestasi/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
