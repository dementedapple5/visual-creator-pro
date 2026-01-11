import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  type?: string;
  noindex?: boolean;
  jsonLd?: object;
}

const SEO = ({
  title,
  description,
  keywords,
  image = "/logo.png",
  type = "website",
  noindex = false,
  jsonLd,
}: SEOProps) => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const currentLang = i18n.language || "en";
  
  // Get base URL
  const baseUrl = typeof window !== "undefined" 
    ? `${window.location.protocol}//${window.location.host}`
    : "https://vizionai.app";
  
  const canonicalUrl = `${baseUrl}${location.pathname}`;
  const fullImageUrl = image.startsWith("http") ? image : `${baseUrl}${image}`;

  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? "property" : "name";
      let element = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    // Update language attribute
    document.documentElement.lang = currentLang;

    // Primary meta tags
    if (title) {
      updateMetaTag("title", title);
    }
    if (description) {
      updateMetaTag("description", description);
    }
    if (keywords) {
      updateMetaTag("keywords", keywords);
    }

    // Robots
    updateMetaTag("robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    // Open Graph tags
    if (title) {
      updateMetaTag("og:title", title, true);
    }
    if (description) {
      updateMetaTag("og:description", description, true);
    }
    updateMetaTag("og:type", type, true);
    updateMetaTag("og:url", canonicalUrl, true);
    updateMetaTag("og:image", fullImageUrl, true);
    updateMetaTag("og:image:alt", title || "Vizion", true);
    updateMetaTag("og:locale", currentLang === "es" ? "es_ES" : "en_US", true);

    // Twitter Card tags
    if (title) {
      updateMetaTag("twitter:title", title);
    }
    if (description) {
      updateMetaTag("twitter:description", description);
    }
    updateMetaTag("twitter:image", fullImageUrl);
    updateMetaTag("twitter:image:alt", title || "Vizion");

    // Alternate language links
    const supportedLangs = ["en", "es"];
    supportedLangs.forEach((lang) => {
      const hrefLang = lang === "en" ? "en" : "es";
      let alternateLink = document.querySelector(`link[rel="alternate"][hreflang="${hrefLang}"]`) as HTMLLinkElement;
      
      if (!alternateLink) {
        alternateLink = document.createElement("link");
        alternateLink.setAttribute("rel", "alternate");
        alternateLink.setAttribute("hreflang", hrefLang);
        document.head.appendChild(alternateLink);
      }
      alternateLink.setAttribute("href", `${baseUrl}${location.pathname}?lang=${lang}`);
    });

    // x-default hreflang
    let defaultAlternate = document.querySelector('link[rel="alternate"][hreflang="x-default"]') as HTMLLinkElement;
    if (!defaultAlternate) {
      defaultAlternate = document.createElement("link");
      defaultAlternate.setAttribute("rel", "alternate");
      defaultAlternate.setAttribute("hreflang", "x-default");
      document.head.appendChild(defaultAlternate);
    }
    defaultAlternate.setAttribute("href", `${baseUrl}${location.pathname}`);

    // JSON-LD Structured Data
    if (jsonLd) {
      let jsonLdScript = document.querySelector('script[type="application/ld+json"]');
      if (!jsonLdScript) {
        jsonLdScript = document.createElement('script');
        jsonLdScript.setAttribute('type', 'application/ld+json');
        document.head.appendChild(jsonLdScript);
      }
      jsonLdScript.textContent = JSON.stringify(jsonLd);
    }
  }, [title, description, keywords, image, type, noindex, canonicalUrl, fullImageUrl, currentLang, location.pathname, baseUrl, jsonLd]);

  return null;
};

export default SEO;
