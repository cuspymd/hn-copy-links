# Privacy Policy

**Extension:** HN Copy Links
**Last updated:** 13 September 2026

## The short version

HN Copy Links collects nothing, sends nothing and has no server. Everything it
does happens inside your browser.

## What the extension stores

One thing: the numeric ids of the Hacker News stories whose links you have
copied, each with the time you copied it. This is what lets the extension dim
the button on a story you have already dealt with.

That list is kept in your browser's local extension storage, on the device
where you copied. It is not synced between your devices, it is not sent
anywhere, and it is not readable by any website. Entries older than 180 days
are deleted automatically, and the whole list goes away if you remove the
extension.

Nothing else is stored. There is no record of which pages you visited, which
links you followed, how long you read, or who you are.

## What the extension sends

Nothing. The extension makes no network requests of its own. It contains no
analytics, no telemetry, no advertising or tracking code, and no remote code of
any kind. The developer receives no data about you and never will, because
there is nowhere for that data to go.

## What the extension can access

The extension runs only on `news.ycombinator.com`. On those pages it reads
story rows in order to build the two links and to place the copy button. It
does not run on any other site and cannot see any other site.

It asks for exactly two permissions:

- `storage` - for the list of copied story ids described above.
- Access to `news.ycombinator.com` - the only site it works on.

## The clipboard

Copying writes to your system clipboard, which is the point of the extension.
The extension only ever writes to the clipboard, in response to your click. It
never reads the clipboard.

## Children

The extension collects no data from anyone, of any age.

## Changes

If a future version changes what is stored or sent, this policy will be updated
before that version is published, and the change will be described in the
release notes.

## Contact

Questions or concerns: open an issue at
<https://github.com/cuspymd/hn-copy-links/issues>, or email cuspymd@gmail.com.

The full source is at <https://github.com/cuspymd/hn-copy-links> and can be
read in a few minutes, which is the best check on everything above.
