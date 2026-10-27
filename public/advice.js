(function(root){
 'use strict';
 const t=key=>root.ClimateI18n?.t(key)||key;
 const absolute=(t,h)=>216.7*(h/100*6.112*Math.exp(17.67*t/(t+243.5)))/(273.15+t);
 function humidity(p,outside){
  if(!p)return {title:t("No recent reading"),tips:[t("Guidance requires a recent sensor reading.")]};
  const h=p.humidity,tips=[];let title;
  if(h<30){title=t("Low humidity");tips.push(t("If the room is too warm, reduce heating before adding humidity."),t("If humidity stays below 30%, consider a dedicated humidifier. Follow its instructions and clean it regularly."),t("Monitor the reading and reduce humidification when it reaches the 30–50% reference range."));}
  else if(h<=50){title=t("Within the reference range");tips.push(t("Additional humidification is not needed. Maintain regular ventilation."),t("Check the history after showers, drying clothes or changes to heating."));}
  else {title=h>=60?t("High humidity"):t("Above the reference range");tips.push(t("Move drying clothes to a ventilated area or use a dehumidifier. Do not add water to radiators."),t("Use extractor fans when showering or cooking. Check windows and walls for condensation."));
   if(Number.isFinite(outside?.temperature_2m)&&Number.isFinite(outside?.relative_humidity_2m)){
    const difference=absolute(p.temperature,h)-absolute(outside.temperature_2m,outside.relative_humidity_2m);
    tips.push(difference>1?t("Outdoor absolute humidity is lower. Ventilate briefly, close the windows and check the trend."):difference< -1?t("Outdoor absolute humidity is higher. Reduce indoor moisture sources and consider a dehumidifier."):t("Indoor and outdoor absolute humidity are similar. Reduce indoor moisture sources first."));
   }else tips.push(t("Ventilation reduces humidity when outdoor air contains less water vapor. Relative humidity percentages alone are not enough for this comparison."));
   tips.push(t("Heating can lower relative humidity without removing water from the air. If high humidity persists, check ventilation, leaks and cold surfaces."));
  }
  return {title,tips};
 }
 function temperature(p){
  if(!p)return [t("Wait for a recent reading before adjusting heating based on this sensor.")];
  if(p.temperature<18)return [t("Check that the thermostat is calling for heat and that radiators are not covered by curtains or furniture."),t("During cold weather, general guidance recommends at least 18 °C in regularly occupied rooms, adjusted to the occupants’ needs."),t("Review the last hour to check whether the room is warming. One sample does not measure radiator performance.")];
  if(p.temperature>24)return [t("Reduce the thermostat gradually if the room is too warm, then observe the response."),t("Use shading to reduce direct sunlight. Ventilate for cooling when outdoor air is cooler."),t("Address moisture sources rather than increasing heating solely to lower relative humidity.")];
  return [t("Set the thermostat for comfort and observe the trend before adjusting it again."),t("Compare readings over an hour to assess changes while heating is on."),t("Keep radiators unobstructed and position the sensor away from direct heat.")];
 }
 const api={humidity,temperature};if(typeof module!=='undefined')module.exports=api;else root.ClimateAdvice=api;
})(typeof window==='undefined'?globalThis:window);
