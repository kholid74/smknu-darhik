import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { T as createAstro, _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as $$AdminLayout } from "./AdminLayout_C6FnThs2.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { n as verifyToken } from "./auth_DDabSvEj.mjs";
//#region src/pages/admin/faq/[id].astro
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
	let faq = isEdit ? await db.faq.findUnique({ where: { id } }) : null;
	if (id && id !== "new" && !faq) return Astro.redirect("/admin/faq?saved=1");
	if (Astro.request.method === "POST") {
		const data = await Astro.request.formData();
		const question = data.get("question")?.toString() || "";
		const answer = data.get("answer")?.toString() || "";
		const order = parseInt(data.get("order")?.toString() || "0");
		if (isEdit) await db.faq.update({
			where: { id },
			data: {
				question,
				answer,
				order
			}
		});
		else await db.faq.create({ data: {
			question,
			answer,
			order
		} });
		return Astro.redirect("/admin/faq?saved=1");
	}
	return renderTemplate`${renderComponent($$result, "AdminLayout", $$AdminLayout, {
		"title": isEdit ? "Edit FAQ" : "Tambah FAQ",
		"user": { role: session.role }
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<form method="POST"><div class="card" style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:end"><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Pertanyaan *</label><input type="text" name="question"${addAttribute(faq?.question || "", "value")} required placeholder="Masukkan pertanyaan..."></div><div><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Urutan</label><input type="number" name="order"${addAttribute(faq?.order ?? 0, "value")} min="0" style="width:80px"></div></div></div><div class="card" style="margin-bottom:16px"><label style="display:block;font-size:13px;font-weight:700;margin-bottom:4px">Jawaban *</label><textarea name="answer" rows="6" style="resize:vertical" required placeholder="Tulis jawaban di sini...">${faq?.answer || ""}</textarea></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary"><span class="material-symbols-outlined">save</span> Simpan</button><a href="/admin/faq" class="btn btn-outline">Batal</a></div></form>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/faq/[id].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/admin/faq/[id].astro";
var $$url = "/admin/faq/[id]";
//#endregion
//#region \0virtual:astro:page:src/pages/admin/faq/[id]@_@astro
var page = () => _id__exports;
//#endregion
export { page };
