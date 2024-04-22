import { FileType } from "codegem-load-file";
import { readFileSync } from "fs";
import { resolve, sep } from "path";
import prettier from "prettier";

export default function createTaroRouteConfig() {
  return (source: FileType[]) => {
    // console.log("source", JSON.stringify(source, null, 2))
    // FIXME: source : FileType
    const routeList = source[0].filesInfo.filter((it) => {
      return it.base === "index.tsx" && !/components/.test(it.dir);
    });
    // 生成所有 Name
    const routeNames = routeList.map((it) => {
      const pathLayer = it.dir.split(sep);
      // TODO: 处理路由别名；实际代码使用无意义的名字
      // const annotation = getAnnotation(readFileSync(it.path, "utf-8"))
      // console.log("%c debug", "color:white;background: rgb(83,143,204);padding:4px", annotation, it.path)
      let routeName = pathLayer[pathLayer.length - 1];

      try {
        const annotation = getAnnotation(readFileSync(it.path, "utf-8"));
        const aliasMap = annotation?.get("alias");
        if (aliasMap) {
          aliasMap.forEach((element) => {
            const obj = element.split("=");
            if (obj?.[0] === "routeAlias" && obj?.[1]) {
              routeName = obj?.[1];
            }
          });
        }
      } catch (error) {
        console.log(error);
      }

      return { name: routeName, path: it.path };
    });
    // console.log("routeNames", sep, routeNames)
    const codePart1 = `import { RouteList } from 'taro-route';

    export type Name = ${routeNames.map((it) => `"${it.name}"`).join(" | ")};

    `;

    // 获取 route： pages/package-xx/[name]/index.tsx
    const packageRouteList = routeList.filter((it) =>
      /pages\/package[A-Z]+\/[a-zA-Z]+/.test(it.path)
    );
    const packageRoute = packageRouteList.map((it) => {
      const pathLayer = it.dir.split(sep);
      const name = routeNames.find((item) => item.path === it.path)?.name;
      const packageName = `${pathLayer[pathLayer.length - 2]}`;
      const routeName = pathLayer[pathLayer.length - 1];
      return {
        name,
        path: `/pages/${packageName}/${routeName}/index`,
        isTab: false,
      };
    });
    // 获取 route: pages/tab/[name]/index.tsx
    const tabRouteList = routeList.filter((it) =>
      /pages\/tab\/[a-zA-Z]+/.test(it.path)
    );
    const tabRoute = tabRouteList.map((it) => {
      const pathLayer = it.dir.split(sep);
      const routeName = pathLayer[pathLayer.length - 1];
      const name = routeNames.find((item) => item.path === it.path)?.name;
      return {
        name,
        path: `/pages/tab/${routeName}/index`,
        isTab: true,
      };
    });
    // 获取 route: pages/[name]/index.tsx
    const normalRouteList = routeList.filter(
      (it) => !packageRouteList.includes(it) && !tabRouteList.includes(it)
    );

    const normalRoute = normalRouteList.map((it) => {
      const pathLayer = it.dir.split(sep);
      const routeName = pathLayer[pathLayer.length - 1];
      const name = routeNames.find((item) => item.path === it.path)?.name;
      return {
        name,
        path: `/pages/${routeName}/index`,
        isTab: false,
      };
    });

    // console.log('packageRouteList', JSON.stringify(packageRouteList, null, 2))
    // console.log('tabRouteList', JSON.stringify(tabRouteList, null, 2))
    // console.log('normalRouteList', normalRoute)
    // console.log('packageRouteList', packageRoute)
    // console.log('tabRouteList', tabRoute)

    const routeConfigList = [...packageRoute, ...tabRoute, ...normalRoute];
    const codePart2 = `export const routeList: RouteList<Name> = ${JSON.stringify(
      routeConfigList
    )};`;

    const pages = routeConfigList.map((it) => it.path.slice(1, it.path.length));

    const codePart3 = `export const pages = ${JSON.stringify(pages)}`;

    const generatedCode = codePart1 + codePart2 + codePart3;

    const formateCode = prettier.format(generatedCode, {
      printWidth: 80,
      tabWidth: 2,
      trailingComma: "all",
      parser: "babel",
    });

    return [
      {
        pathname: resolve("./src", "router/generated.ts"),
        code: formateCode,
      },
    ];
  };
}

//新增
function cacheMap(comments: string[]) {
  const map = new Map<string, Set<string>>();
  const reg = /^@([a-z]*) /;
  comments.forEach((comment) => {
    const regComment = reg.exec(comment);
    if (regComment?.length === 0) return;
    const readyComment = comment.replace(reg, "");
    const key = ((regComment as string[])?.[0] ?? ("" as string))
      .trim()
      .replace("@", "");
    const mapValue = map.get(key);
    if (mapValue) {
      mapValue.add(readyComment);
      return;
    }
    const set = new Set<string>();
    set.add(readyComment);
    map.set(key, set);
  });

  return map;
}

//新增
function getQuery(comment: string) {
  comment = comment.replace(/\*\/$/, ""); //  */替换成""
  let splitComment = comment.split("@");
  splitComment = splitComment
    .slice(1, splitComment.length)
    .map((val) => ("@" + val.replace(/((\* $)|(\* ))/gm, "")).trim());
  return cacheMap(splitComment);
}

function getAnnotation(content: string) {
  const execContent = /\/\*(\s|.)*?\*\//.exec(content);
  if (execContent?.length === 0) return undefined;
  const comment = (execContent as string[])?.[0] ?? "";
  return getQuery(comment);
}
