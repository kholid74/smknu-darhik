import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/guru/[id].astro
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
	const item = isEdit ? await db.teacher.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !item) return Astro.redirect("/admin/guru?saved=1");
	const levels = [
		"Yayasan",
		"Kepala Sekolah",
		"Waka",
		"Kaprog",
		"Guru",
		"Staf"
	];
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const record = {
			name: data.get("name")?.toString() || "",
			title: data.get("title")?.toString() || null,
			position: data.get("position")?.toString() || "",
			subject: data.get("subject")?.toString() || null,
			level: data.get("level")?.toString() || "Guru",
			photoUrl: data.get("photoUrl")?.toString() || null,
			order: parseInt(data.get("order")?.toString() || "0")
		};
		if (isEdit) await db.teacher.update({
			where: { id },
			data: record
		});
		else await db.teacher.create({ data: record });
		return Astro.redirect("/admin/guru?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit Guru/Staf" : "Tambah Guru/Staf",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST" style="max-width:600px"><div class="card" style="display:flex;flex-direction:column;gap:14px"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Nama *</label><input type="text" name="name"${addAttribute(item?.name || "", "value")} required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Gelar</label><input type="text" name="title"${addAttribute(item?.title || "", "value")} placeholder="S.E.,M.Pd."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Jabatan *</label><input type="text" name="position"${addAttribute(item?.position || "", "value")} placeholder="Kepala Sekolah" required></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Mata Pelajaran</label><input type="text" name="subject"${addAttribute(item?.subject || "", "value")} placeholder="Matematika"></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Level</label><select name="level" style="width:100%">${levels.map((l) => renderTemplate`<option${addAttribute(l, "value")}${addAttribute(item?.level === l, "selected")}>${l}</option>`)}</select></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Photo URL</label><input type="text" name="photoUrl"${addAttribute(item?.photoUrl || "", "value")} placeholder="https://..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Order</label><input type="number" name="order"${addAttribute(item?.order ?? 0, "value")} style="width:80px"></div></div><div style="display:flex;gap:10px;margin-top:16px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/guru" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/guru/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/guru/[id].astro";
var $$url = "/admin/guru/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/guru/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
