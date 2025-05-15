document.addEventListener('DOMContentLoaded', function () {
  const htmlInput = document.getElementById('htmlInput');
  const htmlOutput = document.getElementById('htmlOutput');
  const clickLinkInput = document.getElementById('clickLink');
  const optOutLinkInput = document.getElementById('optOutLink');
  const unsubLinkInput = document.getElementById('unsubscribeLink');
  const opensLinkInput = document.getElementById('opensLink');
  const cleanAttributesCheckbox = document.getElementById('cleanAttributes');
  const hideImagesCheckbox = document.getElementById('hideImages');
  const removeTextCheckbox = document.getElementById('removeText');
  const cleanCommentsCheckbox = document.getElementById('cleanComments');
  const removeStylesCheckbox = document.getElementById('removeStyles');
  const applyButton = document.getElementById('applyButton');
  const copyButton = document.getElementById('copyButton');
  const downloadButton = document.getElementById('downloadButton');
  const undoButton = document.getElementById('undoButton');
  const resetButton = document.getElementById('resetButton');
  const statusMessage = document.getElementById('statusMessage');
  const clickCount = document.getElementById('clickCount');
  const optOutCount = document.getElementById('optOutCount');
  const unsubCount = document.getElementById('unsubCount');
  const imageCount = document.getElementById('imageCount');
  const trackingCount = document.getElementById('trackingCount');
  const commentCount = document.getElementById('commentCount');

  let lastHtmlState = ''; // for undo

  // Helper functions to extract and reassemble the head content
  function extractHeadAndBody(html) {
    const headMatch = html.match(/<head>[\s\S]*?<\/head>/i);
    const headContent = headMatch ? headMatch[0] : '';
    let bodyContent = html;
    if (headContent) {
      bodyContent = html.replace(headContent, '<!-- HEAD_PLACEHOLDER -->');
    }
    return { headContent, bodyContent };
  }

  function reassembleHtml(bodyContent, headContent) {
    return headContent ? bodyContent.replace('<!-- HEAD_PLACEHOLDER -->', headContent) : bodyContent;
  }

  // Function to escape regex-special characters
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Function to check if an image is likely a tracking pixel
  function isTrackingPixel(img) {
    const width = img.getAttribute('width');
    const height = img.getAttribute('height');
    const style = img.getAttribute('style') || '';
    const isSmall = (width === '1' || width === '0' || height === '1' || height === '0');
    const hasHiddenStyle = style.includes('display:none') || style.includes('visibility:hidden') || style.includes('opacity:0');
    const src = img.getAttribute('src') || '';
    const hasTrackingUrl = src.includes('/track') || src.includes('/open') || src.includes('/pixel') || src.includes('beacon');
    return isSmall || hasHiddenStyle || hasTrackingUrl;
  }

  // Debounce wrapper
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Function to analyze HTML and count elements
  function analyzeHtml() {
    const html = htmlInput.value;
    if (!html) return;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a');
    let clicks = 0, optOuts = 0, unsubs = 0;
    links.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent.toLowerCase();
      if (!href) return;
      if ((href.includes('/click') || href.includes('track') || text.includes('click') || text.includes('buy') || text.includes('shop') || text.includes('learn more')) &&
          !text.includes('unsubscribe') && !text.includes('opt')) {
        clicks++;
      } else if (href.includes('opt') || text.includes('opt out') || text.includes('opt-out')) {
        optOuts++;
      } else if (href.includes('unsub') || text.includes('unsub') || text.includes('remove me')) {
        unsubs++;
      }
    });

    const images = doc.querySelectorAll('img');
    let imgCount = 0, trackingPixels = 0;
    images.forEach(img => {
      if (isTrackingPixel(img)) {
        trackingPixels++;
      } else {
        imgCount++;
      }
    });

    const elementsWithStyle = doc.querySelectorAll('[style*="background"]');
    let bgImageCount = 0;
    elementsWithStyle.forEach(el => {
      const style = el.getAttribute('style');
      if (style && (style.includes('url(') || style.includes('background-image'))) {
        bgImageCount++;
      }
    });

    const commentIterator = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT, null, false);
    let commentNodes = 0;
    while (commentIterator.nextNode()) {
      commentNodes++;
    }

    clickCount.textContent = clicks;
    optOutCount.textContent = optOuts;
    unsubCount.textContent = unsubs;
    imageCount.textContent = imgCount + bgImageCount;
    trackingCount.textContent = trackingPixels;
    commentCount.textContent = commentNodes;
  }

  const debouncedAnalyze = debounce(analyzeHtml, 250);
  htmlInput.addEventListener('input', debouncedAnalyze);

  // Function to update the HTML based on the cleaning options
  function applyChanges() {
    const html = htmlInput.value;
    if (!html) {
      alert('Please paste some HTML first');
      return;
    }
    // Save state for undo
    lastHtmlState = htmlOutput.value || html;

    let modifiedHtml = html;
    const clickLink = clickLinkInput.value;
    const optOutLink = optOutLinkInput.value;
    const unsubLink = unsubLinkInput.value;
    const opensLink = opensLinkInput.value;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 1. Replace links based on their content/purpose
    if (clickLink || optOutLink || unsubLink) {
      const links = doc.querySelectorAll('a');
      links.forEach(link => {
        const head = doc.querySelector('head');
        if (head && head.contains(link)) return;
        const href = link.getAttribute('href');
        if (!href) return;
        const text = link.textContent.toLowerCase();
        let newHref = null;
        if ((href.includes('/click') || href.includes('track') || text.includes('click') || text.includes('buy') || text.includes('shop') || text.includes('learn more')) &&
            !text.includes('unsubscribe') && !text.includes('opt')) {
          if (clickLink) newHref = clickLink;
        } else if (href.includes('opt') || text.includes('opt out') || text.includes('opt-out')) {
          if (optOutLink) newHref = optOutLink;
        } else if (href.includes('unsub') || text.includes('unsub') || text.includes('remove me')) {
          if (unsubLink) newHref = unsubLink;
        }
        if (newHref) {
          const hrefRegex = new RegExp(`href=["']${escapeRegExp(href)}["']`, 'g');
          modifiedHtml = modifiedHtml.replace(hrefRegex, `href="${newHref}"`);
        }
      });
    }

    // 2. Handle opens tracking
    if (opensLink) {
      const images = doc.querySelectorAll('img');
      let trackingPixelFound = false;
      for (let img of images) {
        if (isTrackingPixel(img)) {
          const src = img.getAttribute('src');
          if (src) {
            const srcRegex = new RegExp(`src=["']${escapeRegExp(src)}["']`, 'g');
            modifiedHtml = modifiedHtml.replace(srcRegex, `src="${opensLink}"`);
            trackingPixelFound = true;
          }
        }
      }
      if (!trackingPixelFound) {
        const trackingPixel = `<img src="${opensLink}" alt="" width="1" height="1" style="display:none; width:1px; height:1px;">`;
        modifiedHtml = modifiedHtml.replace(/<\/body>/i, `${trackingPixel}</body>`);
      }
    }

    // 3. Clean attributes
    if (cleanAttributesCheckbox.checked) {
      const { headContent, bodyContent } = extractHeadAndBody(modifiedHtml);
      let newBodyContent = bodyContent;
      if (clickLink || optOutLink || unsubLink) {
        const patterns = [];
        if (clickLink) patterns.push(clickLink);
        if (optOutLink) patterns.push(optOutLink);
        if (unsubLink) patterns.push(unsubLink);
        newBodyContent = newBodyContent.replace(/href=["']([^"']*)["']/gi, (match, href) => {
          if (patterns.includes(href)) return match;
          return 'href=""';
        });
      } else {
        newBodyContent = newBodyContent.replace(/href=["'][^"']*["']/gi, 'href=""');
      }
      if (opensLink) {
        newBodyContent = newBodyContent.replace(/src=["']([^"']*)["']/gi, (match, src) => {
          if (src === opensLink) return match;
          const isTracking = src.includes('/track') || src.includes('/open') || src.includes('/pixel') || src.includes('beacon');
          if (isTracking && opensLink) return `src="${opensLink}"`;
          return 'src=""';
        });
      } else {
        newBodyContent = newBodyContent.replace(/src=["'][^"']*["']/gi, 'src=""');
      }
      newBodyContent = newBodyContent.replace(/alt=["'][^"']*["']/gi, 'alt=""');
      newBodyContent = newBodyContent.replace(/url\(['"]?[^'")\s]+['"]?\)/gi, 'url("")');
      newBodyContent = newBodyContent.replace(/background-image\s*:\s*[^;]+;/gi, 'background-image: none;');
      modifiedHtml = reassembleHtml(newBodyContent, headContent);
    }

    // 4. Hide images (except tracking pixels)
    if (hideImagesCheckbox.checked) {
      const trackingImgTags = [];
      const images = doc.querySelectorAll('img');
      images.forEach(img => {
        if (isTrackingPixel(img)) {
          const outerHTML = img.outerHTML;
          if (outerHTML) trackingImgTags.push(outerHTML);
        }
      });
      const imgRegex = /<img\s[^>]*>/gi;
      modifiedHtml = modifiedHtml.replace(imgRegex, (match) => {
        if (trackingImgTags.some(tag => tag.includes(match))) {
          return match;
        }
        if (match.includes('style="')) {
          return match.replace(/style="([^"]*)"/i, 'style="display: none !important; $1"');
        } else if (match.includes("style='")) {
          return match.replace(/style='([^']*)'/i, "style='display: none !important; $1'");
        } else {
          return match.replace(/<img/, '<img style="display: none !important;"');
        }
      });
    }

    // 5. Remove visible text
    if (removeTextCheckbox.checked) {
      const { headContent, bodyContent } = extractHeadAndBody(modifiedHtml);
      let newBodyContent = bodyContent.replace(/>([^<>]*)</g, (match, text) => {
        const prevContext = bodyContent.substring(0, bodyContent.indexOf(match));
        const isInScript = prevContext.lastIndexOf('<script') > prevContext.lastIndexOf('</script>');
        const isInStyle = prevContext.lastIndexOf('<style') > prevContext.lastIndexOf('</style>');
        if (isInScript || isInStyle) return match;
        return '><';
      });
      modifiedHtml = reassembleHtml(newBodyContent, headContent);
    }

    // 6. Clean URLs in comments
    if (cleanCommentsCheckbox.checked) {
      modifiedHtml = modifiedHtml.replace(/<!--[\s\S]*?-->/g, (comment) => {
        return comment.replace(/https?:\/\/[^\s'"]+/g, '')
                      .replace(/www\.[^\s'"]+/g, '')
                      .replace(/url\(['"]?[^'")\s]+['"]?\)/g, 'url("")');
      });
    }

    // 7. Remove inline styles if 'Remove Styles' is checked: 
    if (removeStylesCheckbox.checked) {
      // Replace any inline background-color with transparent
      modifiedHtml = modifiedHtml.replace(/background-color\s*:\s*[^;]+;/gi, 'background-color: transparent;');
      // Replace any bgcolor attribute value with transparent
      modifiedHtml = modifiedHtml.replace(/bgcolor\s*=\s*["'][^"']*["']/gi, 'bgcolor="transparent"');
      // Replace generic border property
      modifiedHtml = modifiedHtml.replace(/border\s*:\s*[^;]+;/gi, 'border: 0;');
      // Replace individual side borders (including -width, -style, -color)
      modifiedHtml = modifiedHtml.replace(/border-top(?:-[a-z]+)?\s*:\s*[^;]+;/gi, 'border-top: 0;');
      modifiedHtml = modifiedHtml.replace(/border-right(?:-[a-z]+)?\s*:\s*[^;]+;/gi, 'border-right: 0;');
      modifiedHtml = modifiedHtml.replace(/border-bottom(?:-[a-z]+)?\s*:\s*[^;]+;/gi, 'border-bottom: 0;');
      modifiedHtml = modifiedHtml.replace(/border-left(?:-[a-z]+)?\s*:\s*[^;]+;/gi, 'border-left: 0;');
    }

    htmlOutput.value = modifiedHtml;
    statusMessage.textContent = "Changes applied successfully!";
    statusMessage.classList.remove('hidden');
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 3000);
  }

  // Function to copy the modified HTML to clipboard
  function copyToClipboard() {
    if (!htmlOutput.value) {
      alert('No modified HTML to copy');
      return;
    }
    htmlOutput.select();
    document.execCommand('copy');
    const originalText = copyButton.innerHTML;
    copyButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>Copied!';
    setTimeout(() => {
      copyButton.innerHTML = originalText;
    }, 2000);
  }

  // Function to download modified HTML as a file
  function downloadModifiedHtml() {
    if (!htmlOutput.value) {
      alert('No modified HTML to download');
      return;
    }
    const blob = new Blob([htmlOutput.value], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Function to undo changes (restore previous state)
  function undoChanges() {
    if (lastHtmlState) {
      htmlOutput.value = lastHtmlState;
      statusMessage.textContent = "Undone!";
      statusMessage.classList.remove('hidden');
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 3000);
    }
  }

  // Function to reset all fields
  function resetAll() {
    htmlInput.value = '';
    htmlOutput.value = '';
    clickLinkInput.value = '';
    optOutLinkInput.value = '';
    unsubLinkInput.value = '';
    opensLinkInput.value = '';
    cleanAttributesCheckbox.checked = false;
    hideImagesCheckbox.checked = false;
    removeTextCheckbox.checked = false;
    cleanCommentsCheckbox.checked = false;
    removeStylesCheckbox.checked = false;
    clickCount.textContent = '0';
    optOutCount.textContent = '0';
    unsubCount.textContent = '0';
    imageCount.textContent = '0';
    trackingCount.textContent = '0';
    commentCount.textContent = '0';
    statusMessage.textContent = "Cleared";
    statusMessage.classList.remove('hidden');
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 2000);
  }

  applyButton.addEventListener('click', applyChanges);
  copyButton.addEventListener('click', copyToClipboard);
  downloadButton.addEventListener('click', downloadModifiedHtml);
  undoButton.addEventListener('click', undoChanges);
  resetButton.addEventListener('click', resetAll);

  // Load sample HTML and analyze it
  const sampleHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Newsletter</title>
  <link href="https://example.com/styles.css" rel="stylesheet">
</head>
<body>
  <div>
    <h1>Welcome to our Newsletter</h1>
    <!-- Product link: https://example.com/product-details -->
    <p>Check out our <a href="https://example.com/click/product123">latest product</a>!</p>
    <img src="https://example.com/product-image.jpg" alt="Product" width="300" height="200">
    <p>Learn more about our <a href="https://example.com/track/offer">special offers</a>.</p>
    <div style="background-image: url('https://example.com/background.jpg'); padding: 20px;">
      <p>This has a background image</p>
    </div>
    <!-- Tracking pixel -->
    <img src="https://example.com/track/open.gif" alt="" width="1" height="1" style="display:none;">
    <div class="footer">
      <p><a href="https://example.com/optout">Opt-out from marketing emails</a></p>
      <p><a href="https://example.com/unsubscribe">Unsubscribe</a> from all communications</p>
    </div>
  </div>
</body>
</html>`;
  
  htmlInput.value = sampleHtml;
  analyzeHtml();
});