const { Client } = require("@notionhq/client")
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

if (process.env.NOTION_TOKEN == undefined) {
  console.log("You must specify a token in the NOTION_TOKEN env var");
  return;
}
const notion_token = process.env.NOTION_TOKEN;

if (process.env.NOTION_BLOG_DATABASE_ID == undefined) {
  console.log("You must specify a blog database in the NOTION_BLOG_DATABASE_ID env var");
  return;
}
const notion_blog_database_id = process.env.NOTION_BLOG_DATABASE_ID;

if (process.argv.length < 3) {
  console.log("You must specify the output directory for the generated markdown files");
  return;
}
const output_dir = process.argv[2]

const notion = new Client({
  auth: notion_token,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
  const pages = await notion.databases.query({
  database_id: "8d8e3adab04240cf9509d619b43178d7",
    filter: {
      property: "Publish",
      checkbox: {
        equals: true
      },
    },
  });

  for (let i = 0; i < pages.results.length; i ++) {
    const title = pages.results[i].properties.Name.title[0].plain_text;
    console.log("Processing post: " + title);
		const urlFriendlyTitle = title.split(" ").join("_").toLowerCase();

		const entry_date = pages.results[i].properties.EntryDate.date.start
		const tags = pages.results[i].properties.Tags.multi_select.map(x => x.name);
    const description = `"` + pages.results[i].properties.Description.rich_text[0].plain_text + `"`; // Quotes deal with newlines in the rich text

    const mdblocks = await n2m.pageToMarkdown(pages.results[i].id);
    const mdString = n2m.toMarkdownString(mdblocks);

    const tagString = (tags.length > 0 ?
`
tags: ` + tags.map(tag => `\n  - ` + tag)

: ``)

		const mdStringWithTags = 
`
---
title: ` + title + `
author: Chris Battarbee
annotations: false
date: ` + entry_date +
tagString
+
`
url: ` + urlFriendlyTitle  + `
description: ` + description + `
summary: ` + description + `
---

` + mdString;

    //writing to file
    fs.writeFile(output_dir + urlFriendlyTitle + ".md", mdStringWithTags, (err) => {
      if (err != null) {
        console.log(err);
      }
    });
  }
})();
