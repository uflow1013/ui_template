# 澄序项目约定

- 修改 Web 页面、组件、主题或交互时，使用项目技能 [chengxu-ui](.agents/skills/chengxu-ui/SKILL.md)。先看 [澄序设计规范](doc/design.md)，按需查阅 [Arc 参考资料](doc/arc/SKILL.md)。
- Web 优先组合 `apps/web/src/shared/arc/` 中已有的组件。页面只负责路由、数据与组合，跨页面复用的 UI 放在 `shared/`。在 Web 写代码前，遵循 [Next.js 项目指南](apps/web/AGENTS.md)。
- 改设计数值时修改 `packages/design-tokens/tokens.json`，用 `pnpm tokens:build` 重新生成，不手改 `src/generated.ts`。
- 移动端当前使用 Expo 和 HeroUI Native。Arc 的语义角色、状态和层级可指导移动端设计，原生组件迁移需有明确的移动端任务范围。见 [移动端设计原则](apps/mobile/README.md#arc-设计原则)。
