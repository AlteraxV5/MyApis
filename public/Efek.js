/* ===============================
   FLOWERS EFEK
================================= */
const flowerCount = 15; 

for(let i = 0; i < flowerCount; i++) {
    const flower = document.createElement('div');
    flower.classList.add('falling-flower');
    flower.style.backgroundImage = "url('https://c.termai.cc/i181/aGwK.png')"; 
    flower.style.left = Math.random() * window.innerWidth + "px";
    flower.style.animationDelay = (Math.random() * 5) + "s";

    document.body.appendChild(flower);
}
