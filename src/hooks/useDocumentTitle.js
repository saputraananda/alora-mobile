import { useEffect } from 'react';

/**
 * Custom Hook to set dynamic page title
 * Formula: [Page Name] | Alora Group Indonesia
 * @param {string} pageTitle 
 */
export function useDocumentTitle(pageTitle) {
  useEffect(() => {
    const baseTitle = 'Alora Group Indonesia';
    if (pageTitle) {
      document.title = `${pageTitle} | ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [pageTitle]);
}
