import globeHtml from '../../public/globe.html?raw';

export async function loader() {
  return new Response(globeHtml, {
    headers: {'Content-Type': 'text/html; charset=utf-8'},
  });
}
