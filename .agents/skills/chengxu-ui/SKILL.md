---
name: chengxu-ui
description: Build or review 澄序 project interfaces using its Arc UI components, semantic design tokens, and page patterns. Use for changes to this project's Web pages, navigation, component previews, themes, forms, or interaction states, and for applying its design principles to explicitly requested mobile design work.
---

# 澄序 UI

Read [the project design guide](../../../doc/design.md) first. Project conventions and the current component implementation take precedence over the original Arc examples.

## Build a Web interface

1. Find the closest item in `apps/web/src/shared/arc/` or the `/showcase` catalog in `apps/web/src/app/showcase/components/`. Look at the component's exported props for its actual contract. Use the [Arc component guide](../../../doc/arc/components.md) for picking among similar patterns.
2. Compose the page inside the existing app layout. Use meaningful heading order, keep one primary action per surface, and use semantic roles from the theme. Keep layout with the page and component behavior with the component.
3. Feed controlled values, rows and real callbacks from the product layer. Return asynchronous operations so the component can represent the result. Review the appropriate loading, empty, invalid, pending and error states.
4. Check the affected flow with the keyboard, at a narrow viewport and in light and dark themes. When changing tokens, run `pnpm tokens:check` and `pnpm test:themes`. Use the Web typecheck and lint for source changes.

Use the local `@/shared/arc/` import paths. To add a missing item from a configured registry, run `pnpm exec shadcn add @uiarc/<id>` from `apps/web` and inspect its shared files before merging. Pro downloads use `@uiarc-pro/<id>` and the registry token from the environment.

## Reference by task

- Visual hierarchy and typography: [design](../../../doc/arc/design.md), [composition](../../../doc/arc/composition.md), [copy](../../../doc/arc/copy.md).
- Interaction review: [motion](../../../doc/arc/motion.md), [responsive design](../../../doc/arc/responsive.md), [accessibility](../../../doc/arc/accessibility.md), [checklist](../../../doc/arc/checklist.md).
- Complete page examples: [settings](../../../doc/arc/example-settings.md), [pricing](../../../doc/arc/example-pricing.md), [dashboard](../../../doc/arc/example-dashboard.md).

For mobile design, read the [Expo design principles](../../../apps/mobile/README.md#arc-设计原则). Apply the shared visual roles and interaction states using the platform's existing controls.
