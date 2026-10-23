# Wayne Kanban Timestamps

Adds a custom Kanban view and date maintenance to a Chinese-language personal task workflow built on Obsidian Bases. Requires Obsidian 1.10.2 or newer.

## Usage

Create `Wayne to-do list/个人任务多维表.base` with a view whose type is `wayne-task-board`, and place task notes under `Wayne to-do list/任务/`. The plugin reads and updates the task properties on those notes, including `任务`, `状态`, `创建日期` and `更新日期`. See the source for the expected status vocabulary.

The folder and property names are currently fixed to the original workflow. The plugin does not include any task notes. Only one sync tool should manage a vault at a time.

## Mobile layout

On phones, all status tabs and counts stay visible above a compact task list. Each row retains its creation/update dates; open the note by tapping its title, or use the row's **···** menu to read its full title and details, rename it, or change status. The footer adds a task and pages backward/forward. Page size adapts to the available viewport height and bottom navigation, so a status with hundreds of tasks does not create a long vertical page. Desktop keeps its multi-column board and drag-and-drop.

Task actions use the folder of the actual query entries, including when a synced vault is nested inside another folder. Existing type/ID checks and expected-state protection remain in place. Switching status or resizing retains a valid page; background updates also clamp the page if tasks were removed or moved. On a very short landscape viewport, the host note is anchored once to fit a page; subsequent user scrolling is respected.

The `wayne-task-board` view is registered before asynchronous filesystem work, so restoring a mobile Bases tab does not depend on finding one fixed `.base` file during startup. After updating from a version that showed an unknown view type, restart Obsidian and reopen the board note.

YAML date strings, date objects from another JavaScript context, and ISO timestamps are supported. The calendar day written in the source frontmatter takes precedence over timezone conversion. Invalid or missing required dates remain errors; the plugin does not replace them with today's date. Opening unchanged migrated tasks preserves their original text.

If a board remains empty for three seconds, a local diagnostic notice reports the record folder, disk/index counts, matching metadata counts, and the saved global filter. It is shown once per continuous empty state and sends no data over the network. This notice is diagnostic only: it does not broaden filters or change task data.

## Privacy

This repository is designed to be publishable with only fake examples. It contains no private task data or credentials, and the plugin makes no network requests.

## License

MIT.
