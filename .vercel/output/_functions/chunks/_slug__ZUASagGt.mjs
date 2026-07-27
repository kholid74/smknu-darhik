import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { C as unescapeHTML, T as createAstro, _ as addAttribute, a as Fragment, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { t as $$BaseLayout } from "./BaseLayout_wtbOOnCb.mjs";
//#region src/pages/berita/[slug].astro
var _slug__exports = /* @__PURE__ */ __exportAll({
	default: () => $$Slug,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
createAstro("https://astro.build");
var $$Slug = createComponent(async ($$result, $$props, $$slots) => {
	const Astro = $$result.createAstro($$props, $$slots);
	Astro.self = $$Slug;
	const { slug } = Astro.params;
	const article = await db.article.findFirst({ where: {
		slug,
		published: true
	} });
	if (!article) return Astro.redirect("/berita");
	const catBadge = {
		Prestasi: "bg-[#e8f5e9] text-[#1B7A3D]",
		Keagamaan: "bg-[#fdf6e8] text-[#7e5700]",
		Akademik: "bg-[#e0f0ff] text-[#1a56db]",
		Ekstrakurikuler: "bg-[#f3e8ff] text-[#7c3aed]",
		PPDB: "bg-[#fce7f3] text-[#be185d]"
	};
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": article.title,
		"description": article.excerpt || ""
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<section class="relative bg-[#145a2d] overflow-hidden"><div class="absolute inset-0">${article.imageUrl ? renderTemplate`<img class="w-full h-full object-cover"${addAttribute(article.imageUrl, "src")}${addAttribute(article.title, "alt")}>` : renderTemplate`<div class="w-full h-full bg-[#145a2d]"></div>`}<div class="absolute inset-0 bg-gradient-to-t from-[#145a2d]/90 to-[#145a2d]/40"></div></div><div class="relative z-10 px-4 md:px-6 max-w-3xl mx-auto py-20 md:py-24 text-white text-center"><nav class="flex items-center justify-center gap-2 text-sm text-white/70 mb-5"><a href="/" class="hover:text-white">Beranda</a><span class="material-symbols-outlined text-sm">chevron_right</span><a href="/berita" class="hover:text-white">Berita</a><span class="material-symbols-outlined text-sm">chevron_right</span><span class="text-white font-medium truncate max-w-[200px]">${article.title}</span></nav><span${addAttribute(`inline-block text-xs font-bold px-3 py-1.5 rounded-full mb-4 ${catBadge[article.category] || "bg-white/20 text-white"}`, "class")}>${article.category}</span><h1 class="text-2xl md:text-4xl font-extrabold leading-tight mb-4">${article.title}</h1><div class="flex items-center justify-center gap-4 text-sm text-white/70"><span class="flex items-center gap-1.5"><span class="material-symbols-outlined text-base">calendar_today</span> ${new Date(article.createdAt).toLocaleDateString("id", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric"
	})}</span></div></div></section><article class="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16"><div class="prose prose-lg max-w-none prose-headings:text-[#1c1b1b] prose-headings:font-extrabold prose-p:text-[#3f493f] prose-p:leading-relaxed prose-strong:text-[#1c1b1b] prose-a:text-[#1B7A3D] prose-li:text-[#3f493f] [&amp;_ol]:list-decimal [&amp;_ol]:pl-5 [&amp;_img]:rounded-2xl [&amp;_img]:shadow-card">${renderComponent($$result, "Fragment", Fragment, {}, { "default": async ($$result) => renderTemplate`${unescapeHTML(article.body)}` })}</div><div class="mt-10 pt-6 border-t border-black/10"><a href="/berita" class="inline-flex items-center gap-2 text-[#1B7A3D] font-bold text-sm hover:gap-3 transition-all"><span class="material-symbols-outlined text-base">arrow_back</span> Kembali ke daftar berita</a></div></article><section class="bg-white border-t border-black/5"><div class="max-w-3xl mx-auto px-4 md:px-6 py-14 md:py-16 text-center"><span class="rule-mark mb-5 mx-auto"></span><h2 class="text-2xl md:text-3xl font-extrabold tracking-tight text-[#1c1b1b] mb-4">Ingin tahu lebih banyak?</h2><p class="text-sm md:text-base text-[#6f7a6e] leading-relaxed mb-8 max-w-xl mx-auto">Kunjungi halaman PPDB atau hubungi kami untuk informasi lebih lanjut.</p><div class="flex flex-col sm:flex-row gap-3 justify-center"><a href="/ppdb" class="inline-flex items-center justify-center gap-2 bg-[#1B7A3D] text-white font-bold px-8 py-3.5 rounded-lg text-sm min-h-[48px] hover:bg-[#00602b] transition-colors">Info PPDB <span class="material-symbols-outlined text-lg">arrow_forward</span></a><a href="/kontak" class="inline-flex items-center justify-center gap-2 border-2 border-[#C8963E] text-[#7e5700] font-bold px-8 py-3.5 rounded-lg text-sm min-h-[48px] hover:bg-[#fdf6e8] transition-colors">Hubungi Kami</a></div></div></section>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/berita/[slug].astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/berita/[slug].astro";
var $$url = "/berita/[slug]";
//#endregion
//#region \0virtual:astro:page:src/pages/berita/[slug]@_@astro
var page = () => _slug__exports;
//#endregion
export { page };
