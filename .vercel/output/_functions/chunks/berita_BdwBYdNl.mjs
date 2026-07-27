import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { _ as addAttribute, d as renderTemplate, h as maybeRenderHead, i as renderComponent } from "./server_C1dVeAgT.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
import { t as $$BaseLayout } from "./BaseLayout_wtbOOnCb.mjs";
//#region src/pages/berita.astro
var berita_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Berita,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Berita = createComponent(async ($$result, $$props, $$slots) => {
	const articles = await db.article.findMany({
		where: { published: true },
		orderBy: { createdAt: "desc" },
		take: 12
	});
	const catBadge = {
		Prestasi: "bg-[#e8f5e9] text-[#1B7A3D]",
		Keagamaan: "bg-[#fdf6e8] text-[#7e5700]",
		Akademik: "bg-[#e0f0ff] text-[#1a56db]",
		Ekstrakurikuler: "bg-[#f3e8ff] text-[#7c3aed]",
		PPDB: "bg-[#fce7f3] text-[#be185d]"
	};
	return renderTemplate`${renderComponent($$result, "BaseLayout", $$BaseLayout, {
		"title": "Berita & Kegiatan",
		"description": "Berita dan kegiatan terbaru SMKS NU Darul Hikam Karanggeneng."
	}, { "default": ($$result) => renderTemplate`${maybeRenderHead($$result)}<section class="relative bg-[#145a2d] overflow-hidden"><div class="absolute inset-0"><img class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80" alt="Kegiatan sekolah" loading="eager" onerror="this.style.background='#145a2d'"><div class="absolute inset-0 bg-[#145a2d]/80"></div></div><div class="relative z-10 px-4 md:px-6 max-w-3xl mx-auto py-16 md:py-20 text-white text-center"><nav class="flex items-center justify-center gap-2 text-sm text-white/70 mb-4"><a href="/" class="hover:text-white transition-colors">Beranda</a><span class="material-symbols-outlined text-sm">chevron_right</span><span class="text-white font-medium">Berita & Kegiatan</span></nav><h1 class="text-3xl md:text-4xl font-extrabold leading-tight mb-3">Berita & Kegiatan</h1><p class="text-base md:text-lg text-white/80 max-w-lg mx-auto leading-relaxed">Informasi dan cerita terbaru dari lingkungan SMKS NU Darul Hikam.</p></div></section><section class="max-w-6xl mx-auto px-4 md:px-6 py-16 md:py-20">${articles.length === 0 ? renderTemplate`<p class="text-center text-[#6f7a6e] py-12">Belum ada artikel.</p>` : renderTemplate`<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">${articles.map((a) => renderTemplate`<article class="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-[0_2px_8px_rgba(27,122,61,0.04)] hover:shadow-[0_6px_20px_rgba(27,122,61,0.1)] transition-shadow group"><a${addAttribute(`/berita/${a.slug}`, "href")} class="block overflow-hidden">${a.imageUrl ? renderTemplate`<img class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"${addAttribute(a.imageUrl, "src")}${addAttribute(a.title, "alt")} loading="lazy">` : renderTemplate`<div class="w-full h-48 bg-[#e8f5e9] flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-[#1B7A3D]/30">article</span></div>`}</a><div class="p-5"><div class="flex items-center gap-3 mb-3"><span${addAttribute(`text-xs font-semibold px-2.5 py-1 rounded-full ${catBadge[a.category] || "bg-gray-100 text-gray-600"}`, "class")}>${a.category}</span><span class="text-xs text-[#6f7a6e]">${new Date(a.createdAt).toLocaleDateString("id", {
		day: "numeric",
		month: "short",
		year: "numeric"
	})}</span></div><a${addAttribute(`/berita/${a.slug}`, "href")} class="block mb-2"><h3 class="font-bold text-[#1c1b1b] leading-snug group-hover:text-[#1B7A3D] transition-colors line-clamp-2">${a.title}</h3></a><p class="text-sm text-[#6f7a6e] leading-relaxed line-clamp-2 mb-4">${a.excerpt}</p><a${addAttribute(`/berita/${a.slug}`, "href")} class="inline-flex items-center gap-1.5 text-sm font-bold text-[#1B7A3D] hover:underline">Baca selengkapnya <span class="material-symbols-outlined text-sm">arrow_forward</span></a></div></article>`)}</div>`}</section><section class="relative bg-[#1B7A3D] text-white overflow-hidden"><svg class="absolute -top-16 -right-16 w-80 h-80 text-white/10 pointer-events-none" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M50 5 L61 39 L95 39 L67 60 L78 95 L50 74 L22 95 L33 60 L5 39 L39 39 Z" stroke="currentColor" stroke-width="0.8"></path></svg><div class="relative max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-20 text-center"><h2 class="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">Jadi bagian dari cerita kami</h2><p class="text-white/85 mb-8 text-sm md:text-lg leading-relaxed max-w-xl mx-auto">Daftar PPDB 2026/2027 dan ciptakan prestasimu sendiri bersama SMKS NU Darul Hikam.</p><a href="/ppdb" class="inline-flex items-center justify-center gap-2 bg-[#C8963E] text-white font-bold px-8 py-3.5 rounded-lg text-sm min-h-[48px] hover:bg-[#C8963E]/90 transition-colors">Daftar Sekarang <span class="material-symbols-outlined text-lg">arrow_forward</span></a></div></section>` })}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/berita.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/berita.astro";
var $$url = "/berita";
//#endregion
//#region \0virtual:astro:page:src/pages/berita@_@astro
var page = () => berita_exports;
//#endregion
export { page };
