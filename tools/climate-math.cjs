function validReading(p){return p?.protocol===2&&p.type==='climate'&&p.valid===true&&Number.isFinite(p.temperature)&&p.temperature>=-20&&p.temperature<=80&&Number.isFinite(p.humidity)&&p.humidity>=0&&p.humidity<=100;}
function absoluteHumidity(t,h){return 216.7*(h/100*6.112*Math.exp(17.67*t/(t+243.5)))/(273.15+t);}
function compareAir(indoor,outdoor){if(!validReading(indoor)||!outdoor?.current||!Number.isFinite(outdoor.current.temperature_2m)||!Number.isFinite(outdoor.current.relative_humidity_2m))return null;const inside=absoluteHumidity(indoor.temperature,indoor.humidity),outside=absoluteHumidity(outdoor.current.temperature_2m,outdoor.current.relative_humidity_2m);return {inside,outside,difference:inside-outside};}
module.exports={validReading,absoluteHumidity,compareAir};
