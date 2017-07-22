# naivebot

Simulates googlebot visiting pages, kinda.

This is very experimental, naive and a possibly plain wrong approach.

I'm not publishing this as a npm module because it's much easier to edit the hooks in the index.js
itself then to create override capabilities for those.


## config

Edit `config.json` file.

```js
{
  "domain": "pixels.camp", // domain to scrap
  "userAgent": "", // user agent to set (TODO)
  "resolution": [800, 600], // screen resolution to use
  "pages": ["https://pixels.camp/"] // initial pages (kinda like sitemap.xml)
}
```


## current crawling behaviour

Pages and their screenshots are persisted to `pages` directory.

Bootstrapped `toVisit` array of pages comes from `config.json`.
While that array has elements, scrap continues.
Each scrap consists of several promises being fulfilled:

* waitPageReady - resolves once page is deemed ready. currenly waits 5 secs.
* atPageStart - something to do once page is ready. ex: dismiss modal.
* indexFollowCriteria - returns object with booleans for `index` and `follow`, work like the robots counterpart, i.e., index saves the scrapped page, follow adds found links to `toVisit`.

Notice that most of these receive and return an object with:
* nightmare - the nightmare instance
* o - scrapped data from page
* state - scrapping state.

Indexed pages are stored to `<page>.json` and screenshot to `<page>.png`,
where `<page>` is a file-system friendly version of the page path.


This is the object persisted for every page marked for storage:

```js
{
  url          : location.href
  title        : document.title
  text         : document.body.innerText
  html         : document.documentElement.outerHTML
  mRobots      : // meta robots
  mTitle       : // meta title
  mKeywords    : // meta keywords
  mDescription : // meta description
  h1           : // first h1's inner text
  afterH1      : // inner text of element after first h1
  links        : // array of a hrefs
}
```

Notice this h1 and afterH1, which are attempts to elect alternate titles and descriptions.


## TODO

* investigate how googlebot determines page loaded or alternate clever approach
* check if links scrapped are as naive as ours (`<a>`s on page body)
* improve path processing - support #! paths
* (less relevant) map robots.txt and sitemap.xml to config.json


## references


https://developers.google.com/search/reference/robots_meta_tag#valid-indexing--serving-directives
https://github.com/segmentio/nightmare/blob/master/Readme.md
https://segment.com/blog/ui-testing-with-nightmare/
https://varvy.com/googlebot.html
https://support.google.com/webmasters/answer/96569?hl=en
