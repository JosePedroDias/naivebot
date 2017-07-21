const fs = require("fs");
const Nightmare = require("nightmare");

const CFG = require("./config.json");

function saveFile(filename, data) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(filename, data, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function stringifyUrl(u) {
  const i = u.indexOf(CFG.domain);
  u = u.substring(i + CFG.domain.length);
  return u.replace(/([\/\:?&])/g, "_");
}

function has(arr, item) {
  return arr.indexOf(item) !== -1;
}

// TODO NAIVE AND DUMB. IS THERE A BETTER GENERIC APPROACH?
function waitPageReady({ nightmare, o, state }) {
  return new Promise(function(resolve, reject) {
    nightmare.wait(5000).then(function() {
      resolve({ nightmare, o, state });
    }, reject);
  });
}

// MOSTLY STRAIGHTFORWARD. H1 AND AFTERH1 EXPERIMENTAL
function scrap({ nightmare, o, state }) {
  return new Promise(function(resolve, reject) {
    nightmare
      .evaluate(function() {
        const headEl = document.head;
        const bodyEl = document.body;

        const mRobots = headEl.querySelector('meta[name="robots"]');
        const mTitle = headEl.querySelector('meta[name="title"]');
        const mKeywords = headEl.querySelector('meta[name="keywords"]');
        const mDescription = headEl.querySelector('meta[name="description"]');

        const h1El = bodyEl.querySelector("h1");
        const afterH1 =
          h1El &&
          h1El.parentNode.children[
            Array.prototype.slice
              .apply(h1El.parentNode.children)
              .indexOf(h1El) + 1
          ];

        const links = new Set();
        Array.prototype.slice
          .apply(document.body.querySelectorAll("a"))
          .map(function(aEl) {
            return aEl.href;
          })
          .filter(function(href) {
            return !!href;
          })
          .forEach(function(href) {
            links.add(href);
          });

        return {
          title: document.title,
          mRobots: mRobots && mRobots.content,
          mTitle: mTitle && mTitle.content,
          mKeywords: mKeywords && mKeywords.content,
          mDescription: mDescription && mDescription.content,
          text: document.body.innerText,
          h1: h1El && h1El.innerText,
          afterH1: afterH1 && afterH1.innerText,
          html: document.documentElement.outerHTML,
          links: Array.from(links)
        };
      })
      .then(function(o2) {
        o2.url = o.url;
        resolve({ nightmare, o: o2, state });
      }, reject);
  });
}

// TODO VALIDATE CORRECTION
function indexFollowCriteria({ nightmare, o, state }) {
  return new Promise(function(resolve, reject) {
    const robots = !o.mRobots ? [] : o.mRobots.trim().split(",");

    resolve({
      index: !(has(robots, "noindex") || has(robots, "none")),
      follow: !(has(robots, "nofollow") || has(robots, "none"))
    });
  });
}

// TODO OVERRIDE THIS IF YOU NEED IT
function atPageStart({ nightmare, o, state }) {
  Promise.resolve({ nightmare, o, state });
}

function crawlPage({ nightmare, o, state }) {
  return new Promise(function(resolve, reject) {
    nightmare
      .goto(o.url)
      .then(waitPageReady.bind(null, { nightmare, o, state }))
      .then(atPageStart)
      .then(scrap)
      .then(function({ nightmare, o, state }) {
        state.processed.add(o.url);
        state.visited.add(o.url);

        indexFollowCriteria({ nightmare, o, state }).then(function({
          index,
          follow
        }) {
          if (follow) {
            o.links.forEach(function(href) {
              if (href.indexOf(CFG.domain) === -1) {
                return; // don't scrap away from domain
              }
              if (href.indexOf("/product/") !== -1) {
                // TODO EXPERIMENT, REMOVE
                return; // trying to mimic robots.txt Disallow */product/*
              }
              if (!state.processed.has(href)) {
                state.processed.add(href);
                state.toVisit.push(href);
              }
            });
          }
          if (index) {
            state.indexed.add(o.url);
            const u = stringifyUrl(o.url);
            const fnP = `./pages/${u}.json`;
            const fnI = `./pages/${u}.png`;
            saveFile(fnP, JSON.stringify(o))
              .then(function() {
                return nightmare.screenshot(fnI).then(resolve, reject);
              })
              .catch(reject);
          } else {
            resolve();
          }
        }, reject);
      })
      .catch(reject);
  });
}

function crawl({ nightmare }) {
  return new Promise(function(resolve, reject) {
    const state = {
      processed: new Set(),
      visited: new Set(),
      indexed: new Set(),
      toVisit: CFG.pages
    };

    function step() {
      console.log(state);

      if (state.toVisit.length === 0) {
        resolve({ nightmare, state });
      }

      const page = state.toVisit.shift();
      const o = { url: page };
      crawlPage({ nightmare, o, state }).then(step, reject);
    }

    step();
  });
}

// bootstrap it...

const nightmare = Nightmare({
  show: true
  // dock: true,
  // openDevTools: { mode: 'detach' },
  // switches: { 'ignore-certificate-errors': true }
});

nightmare
  .viewport(CFG.resolution[0], CFG.resolution[1])
  .then(function() {
    return crawl({ nightmare });
  })
  .then(
    function({ nightmare, state }) {
      console.log("all done");

      function list(arr, title) {
        console.log(`\n${title}:`);
        console.log(
          arr
            .map(function(u) {
              return `* ${u}`;
            })
            .join("\n")
        );
      }

      const processed = Array.from(state.processed);
      const visited = Array.from(state.visited);
      const indexed = Array.from(state.indexed);

      list(processed, "processed");
      list(visited, "visited");
      list(indexed, "indexed");

      nightmare.halt(0, true);
    },
    function(err) {
      console.error(err);
      nightmare.halt(0, true);
    }
  );
