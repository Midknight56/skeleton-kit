# Release metadata

`docs/demo-video.txt` holds the URL of the released demo film, on one line. It is the one current record.

`tests/docs/hero.test.ts` reads it, checks it is a full YouTube link, and checks that the top of `README.md` holds the same URL. To publish the next verified film, change that file and the Video link in the README. No test needs an edit.

Until the new film is released the file keeps the public link.
