const { Client } = require("@notionhq/client")
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');

if (process.env.NOTION_TOKEN == undefined) {
  console.log("You must specify a token in the NOTION_TOKEN env var");
  return;
}

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});


if (process.argv.length < 3) {
  console.log("You must specify the output directory for the generated markdown files");
  return;
}
const output_dir = process.argv[2]

// passing notion client to the option
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
    const mdblocks = await n2m.pageToMarkdown(pages.results[i].id);
    const mdString = n2m.toMarkdownString(mdblocks);

    //writing to file
    fs.writeFile(output_dir + title.split(" ").join("_").toLowerCase() + ".md", mdString, (err) => {
      if (err != null) {
        console.log(err);
      }
    });
  }
})();
