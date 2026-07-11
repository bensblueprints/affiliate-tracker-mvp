// The merchant-side snippet, served at GET /track.js.
// Drop on any page of the merchant site:
//   <script defer src="https://your-reflink-host/track.js"></script>
// It captures ?ref=CODE from the URL into localStorage (attribution window is
// enforced server-side too), and exposes:
//   window.reflink.convert(orderId, amount)   // client-side conversion event
// The postback URL (GET /convert?ref=&order_id=&amount=) remains the
// recommended server-to-server option. No cookies are set by this script on
// the merchant domain beyond localStorage; no DOM is ever written (XSS-safe).
const TRACKER = `!function(){var q,K="reflink_ref",T="reflink_at",s=document.currentScript,a=s?s.src.replace(/track\\.js[^/]*$/,"convert"):"/convert";try{q=new URLSearchParams(location.search).get("ref")}catch(e){}if(q&&/^[A-Za-z0-9_-]{1,64}$/.test(q)){try{localStorage.setItem(K,q),localStorage.setItem(T,String(Date.now()))}catch(e){}}function g(){try{return localStorage.getItem(K)||""}catch(e){return""}}window.reflink={code:g,convert:function(o,m){var r=g();if(!r||!o)return;var u=a+"?ref="+encodeURIComponent(r)+"&order_id="+encodeURIComponent(String(o))+"&amount="+encodeURIComponent(String(m==null?0:m));(navigator.sendBeacon&&navigator.sendBeacon(u))||fetch(u,{method:"POST",keepalive:!0})}}}();`;

module.exports = { TRACKER };
