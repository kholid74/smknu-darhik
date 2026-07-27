import { n as __exportAll, t as createComponent } from "./compiler_KPfSmO3O.mjs";
import { d as renderTemplate } from "./server_C1dVeAgT.mjs";
import { t as db } from "./prisma_CgM_1iz_.mjs";
//#region src/pages/api/test.astro
var test_exports = /* @__PURE__ */ __exportAll({
	default: () => $$Test,
	file: () => $$file,
	prerender: () => false,
	url: () => $$url
});
var $$Test = createComponent(async ($$result, $$props, $$slots) => {
	const settings = await db.setting.findFirst();
	const departments = await db.department.findMany({ orderBy: { order: "asc" } });
	const teachers = await db.teacher.findMany({ orderBy: { order: "asc" } });
	const data = {
		status: "ok",
		settings: {
			name: settings?.siteName,
			phone: settings?.phone
		},
		departments,
		teachers
	};
	return renderTemplate`${JSON.stringify(data, null, 2)}`;
}, "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/test.astro", void 0);
var $$file = "/Users/kholidputra/workspace/pribadi/projects/smk-darulhikam/website/src/pages/api/test.astro";
var $$url = "/api/test";
//#endregion
//#region \0virtual:astro:page:src/pages/api/test@_@astro
var page = () => test_exports;
//#endregion
export { page };
