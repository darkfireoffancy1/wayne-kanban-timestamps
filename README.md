# Wayne Kanban Timestamps

Adds a custom Kanban view and date maintenance to a Chinese-language personal task workflow built on Obsidian Bases. Requires Obsidian 1.10.2 or newer.

## Usage

Create `Wayne to-do list/个人任务多维表.base` with a view whose type is `wayne-task-board`, and place task notes under `Wayne to-do list/任务/`. The plugin reads and updates the task properties on those notes, including `任务`, `状态`, `创建日期` and `更新日期`. See the source for the expected status vocabulary.

The folder and property names are currently fixed to the original workflow. The plugin does not include any task notes. Only one sync tool should manage a vault at a time.

## Mobile layout

Swipe horizontally between status columns. A column fits the available note width, including when embedded. Use the always-visible status menu to move a task on touch devices; desktop drag-and-drop remains available. Titles wrap, and edit, add, and status controls use larger touch targets.

The `wayne-task-board` view is registered before asynchronous filesystem work, so restoring a mobile Bases tab does not depend on finding one fixed `.base` file during startup. After updating from a version that showed an unknown view type, restart Obsidian and reopen the board note.

## Privacy

This repository is designed to be publishable with only fake examples. It contains no private task data or credentials, and the plugin makes no network requests.

## License

MIT.
