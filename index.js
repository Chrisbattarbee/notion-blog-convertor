const { Client } = require("@notionhq/client")
const { NotionToMarkdown } = require("notion-to-md");
const fs = require('fs');
const https = require('https')
const url = require("url");
const path = require("path");

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

if (process.env.NOTION_BLOG_IMAGE_OUTPUT_DIR == undefined) {
  console.log("You must specify an image output directory in the NOTION_BLOG_IMAGE_OUTPUT_DIR env var");
  return;
}
const notion_blog_image_output_dir = process.env.NOTION_BLOG_IMAGE_OUTPUT_DIR;

if (process.env.NOTION_BLOG_IMAGE_ROOT_PATH == undefined) {
  console.log("You must specify an image root path in the NOTION_BLOG_IMAGE_OUTPUT_DIR env var");
  return;
}
const notion_blog_image_root_path = process.env.NOTION_BLOG_IMAGE_ROOT_PATH;

var pull_unpublished_posts = false;
if (process.env.NOTION_BLOG_PULL_UNPUBLISHED_POSTS != undefined) {
  console.log("Will pull unpublished posts");
  pull_unpublished_posts = true;
}

if (process.argv.length < 3) {
  console.log("You must specify the output directory for the generated markdown files");
  return;
}
const output_dir = process.argv[2]

const notion = new Client({
  auth: notion_token,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

// We want to download images and copy them to the image directory of the site
// so we can serve them ourselves and not point at notion s3 buckets.
// This has the advantage of being quicker to load and not prone to api rate limiting
n2m.setCustomTransformer('image', async (block) => {
  let blockContent = block.image;
  const imageCaptionPlain = blockContent.caption
    .map((item) => item.plain_text)
    .join("");
  const imageType = blockContent.type;
	
	var imageUrl;
  if (imageType === "external") {
    imageUrl = blockContent.external.url;
	}
  if (imageType === "file") {
    imageUrl = blockContent.file.url;
	}

	const imageOutputDir = notion_blog_image_output_dir;
  if (!fs.existsSync(imageOutputDir)){
    fs.mkdirSync(imageOutputDir, { recursive: true });
  }

	const imageName = path.basename(url.parse(imageUrl).pathname);
	const imagePath = imageOutputDir + imageName
	// Download the image
  https.get(imageUrl, resp => resp.pipe(fs.createWriteStream(imagePath)));
	return `![${imageCaptionPlain}](${notion_blog_image_root_path}${imageName})`;
});


(async () => {
  var pages;
  if (pull_unpublished_posts) {
    pages = await notion.databases.query({
      database_id: "8d8e3adab04240cf9509d619b43178d7" });
  } else {
    pages = await notion.databases.query({
      database_id: "8d8e3adab04240cf9509d619b43178d7",
        filter: {
          property: "Publish",
          checkbox: {
            equals: true
          },
        },
      });
  }
  for (let i = 0; i < pages.results.length; i ++) {
    const title = pages.results[i].properties.Name.title[0].plain_text;
    console.log("Processing post: " + title);
    const urlFriendlyTitle = title.split(" ").join("_").toLowerCase();

    const entry_date = pages.results[i].properties.EntryDate.date.start
		console.log("  Entry Date: " + entry_date);

    const description = `"` + pages.results[i].properties.Description.rich_text[0].plain_text + `"`; // Quotes deal with newlines in the rich text
		console.log("  Description: " + description);
    

    const tags = pages.results[i].properties.Tags.multi_select.map(x => x.name);
    const tagString = (tags.length > 0 ?
      `tags: ` + tags.map(tag => `\n  - ` + tag).join("")
                      : ``)
    console.log("  " + tagString);

    const mdblocks = await n2m.pageToMarkdown(pages.results[i].id);
    const mdString = n2m.toMarkdownString(mdblocks);
    const mdStringWithFrontMatter = 
`
---
title: ` + title + `
author: Chris Battarbee
annotations: false
date: ` + entry_date + `
` +
tagString
+
`
url: ` + urlFriendlyTitle  + `
description: ` + description + `
summary: ` + description + `
---

` + mdString;

    //writing to file
    if (!fs.existsSync(output_dir)){
      fs.mkdirSync(output_dir, { recursive: true });
    }
    fs.writeFile(output_dir + urlFriendlyTitle + ".md", mdStringWithFrontMatter, (err) => {
      if (err != null) {
        console.log(err);
      }
    });
  }
})();
