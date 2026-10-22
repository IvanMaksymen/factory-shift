/* Factory Shift v0.3 — authored progression and production catalog. */
(function(root){
'use strict';
const metals = [
 ['nickel','Nickel','Ni','#a4c7a6',6,18],['aluminium','Aluminium','Al','#c3dfeb',6,18],
 ['tin','Tin','Sn','#c0c9cd',5,16],['zinc','Zinc','Zn','#adc5e4',5,12],
 ['silver','Silver','Ag','#e3e5ed',12,8],['gold','Gold','Au','#f4cf68',24,4]
];
// id, name, input quantities, output name, value, seconds, cost, power, unlock stage, family
const machines = [
 ['nickelRefinery','Nickel refinery',{nickelOre:1},'Nickel',6,2.5,180,3,8,'metals'],
 ['aluminiumRefinery','Aluminium refinery',{aluminiumOre:1},'Aluminium',6,2.7,190,3,9,'metals'],
 ['tinRefinery','Tin refinery',{tinOre:1},'Tin',5,2.4,180,3,10,'metals'],
 ['zincRefinery','Zinc refinery',{zincOre:1},'Zinc',5,2.4,190,3,12,'metals'],
 ['silverRefinery','Silver refinery',{silverOre:1},'Silver',12,3.4,280,4,15,'metals'],
 ['goldRefinery','Gold refinery',{goldOre:1},'Gold',24,4,360,4,18,'metals'],
 ['alloyFurnace','Alloy furnace',{copper:2,tin:1},'Bronze',20,4,300,4,10,'metals'],
 ['tubeMill','Tube mill',{bronze:1},'Bronze tube',28,3,240,3,11,'production'],
 ['beamRoller','Beam roller',{steel:1},'Steel beam',30,3.6,280,3,13,'production'],
 ['foilRoller','Foil roller',{aluminium:1},'Aluminium foil',12,2.4,200,2,9,'production'],
 ['contactPress','Contact press',{gold:1,wire:1},'Gold contact',48,3.5,420,3,19,'advanced'],
 ['silverCoiler','Silver coiler',{silver:1},'Silver coil',22,3,300,3,16,'production'],
 ['batteryPlant','Battery plant',{nickel:2,wire:1},'Battery',32,4,300,4,14,'advanced'],
 ['solderStation','Solder station',{tin:1,wire:1},'Solder unit',24,3,260,3,17,'advanced'],
 ['radiatorWorks','Radiator works',{tube:2,foil:2},'Radiator',98,4.5,420,4,21,'advanced'],
 ['sensorBench','Sensor bench',{circuit:1,coil:1},'Sensor',80,4,420,4,22,'advanced'],
 ['controllerWorks','Controller works',{circuit:1,contact:1,solder:1},'Controller',142,5,550,5,23,'advanced'],
 ['turbineForge','Turbine forge',{beam:2,gear:2},'Turbine',110,5,480,5,24,'advanced'],
 ['droneBay','Drone bay',{motor:1,battery:1,controller:1},'Drone',310,6,650,5,25,'advanced'],
 ['watchmaker','Watchmaker',{gear:2,electrum:1},'Precision watch',110,5,520,4,20,'advanced'],
 ['jeweler','Jeweler',{gold:1,silver:1},'Jewelry',62,4,460,3,18,'advanced'],
 ['engineWorks','Engine works',{turbine:1,radiator:1,motor:1},'Engine',355,6,700,6,26,'advanced'],
 ['satelliteBay','Satellite bay',{drone:1,sensor:2,foil:2},'Satellite',650,7.5,900,6,28,'advanced'],
 ['quantumLab','Quantum lab',{satellite:1,robot:2,controller:2},'Quantum core',1600,9,1400,7,31,'advanced']
];
const outputs=['nickel','aluminium','tin','zinc','silver','gold','bronze','tube','beam','foil','contact','coil','battery','solder','radiator','sensor','controller','turbine','drone','watch','jewelry','engine','satellite','core'];
const alloys = [
 ['bronze','Bronze',{copper:2,tin:1},20,10,'#c89461'],
 ['brass','Brass',{copper:2,zinc:1},21,12,'#d9bd73'],
 ['steel','Alloy steel',{iron:2,nickel:1},20,13,'#a9bec9'],
 ['electrum','Electrum',{gold:1,silver:1},50,20,'#e8d594'],
 ['duralumin','Duralumin',{aluminium:2,copper:1},24,27,'#b6d4de'],
 ['resistanceAlloy','Resistance alloy',{nickel:2,copper:1},24,29,'#bfc9b2']
];
// 32 authored contracts extend the original eight.
const missions = [
 ['A new element',{nickel:24},'Survey a nickel deposit, then connect Extractor → Nickel refinery → dock.'],
 ['Light work',{aluminium:24,foil:18},'Refine aluminium and roll some ingots into foil.'],
 ['The bronze age',{bronze:24},'Alloy furnace: 2 copper + 1 tin → bronze. Select Bronze in its inspector.'],
 ['Pipes for the district',{tube:32,rod:30},'Turn bronze into tubes and keep a separate iron rod line shipping.'],
 ['A touch of brass',{brass:30},'Survey zinc. Choose Brass in the Alloy furnace: 2 copper + 1 zinc.'],
 ['Stronger together',{steel:30,beam:24},'Alloy steel combines 2 iron + 1 nickel. Feed steel into the Beam roller.'],
 ['Portable power',{battery:32,wire:50},'Supply 2 nickel + 1 wire to the Battery plant.'],
 ['Silver lining',{silver:30},'Silver is uncommon. Survey an empty deposit if exploration did not find it.'],
 ['Coils and connections',{coil:32,circuit:24},'Silver coils and circuits will become sensor components later.'],
 ['Hold it together',{solder:36,casing:28},'Solder station: tin + wire. Keep housings flowing on another line.'],
 ['A golden opportunity',{gold:24,jewelry:12},'Gold has a 4% chance per new deposit. A targeted survey guarantees access.'],
 ['Perfect contact',{contact:30},'Feed gold and copper wire into the Contact press.'],
 ['Time is precious',{electrum:20,watch:18},'Gold + silver → electrum. Combine electrum with 2 gears at the Watchmaker.'],
 ['Keep your cool',{radiator:24},'Radiators need 2 bronze tubes and 2 aluminium foils each.'],
 ['A factory with senses',{sensor:30},'Circuit + silver coil → sensor. Watch both input buffers.'],
 ['Under control',{controller:24},'Feed circuits, gold contacts and solder from three sides.'],
 ['Turning the future',{turbine:26},'Combine 2 steel beams + 2 gears into a turbine.'],
 ['First flight',{drone:20},'Drone bay: motor + battery + controller.'],
 ['Engine room',{engine:22},'Engine works needs a turbine, radiator and motor per engine.'],
 ['Built to be light',{duralumin:60,foil:60},'Choose Duralumin: 2 aluminium + 1 copper. Plan shared copper supply.'],
 ['Above the clouds',{satellite:14},'Satellite bay: drone + 2 sensors + 2 foils.'],
 ['Resistance is useful',{resistanceAlloy:60,battery:40},'Choose Resistance alloy: 2 nickel + 1 copper. Split nickel between two lines.'],
 ['The robotics district',{robot:35,controller:30},'Keep the robot line supplied while shipping spare controllers.'],
 ['A quantum leap',{core:10},'Quantum lab: satellite + 2 service robots + 2 controllers.'],
 ['A city of metal',{bronze:80,brass:80,steel:80},'Use three Alloy furnaces with independent recipes.'],
 ['Power for everyone',{battery:70,turbine:45,engine:30},'Balance nickel supply and steel throughput across three production chains.'],
 ['The observatory',{sensor:80,satellite:24},'Split sensor output between shipping and satellite assembly.'],
 ['Fine craftsmanship',{jewelry:65,watch:55,contact:60},'Share gold and silver between finished goods and electronics.'],
 ['The sky shift',{drone:50,satellite:30},'Maintain spare drone capacity beyond satellite demand.'],
 ['Machines for tomorrow',{robot:60,engine:40,core:16},'Build parallel supply lines and upgrade individual machines to balance their output.'],
 ['Metallurgy master',{electrum:100,duralumin:100,resistanceAlloy:100},'Three high-value alloys, three furnaces. Upgrade the slowest inputs first.'],
 ['The grand factory',{core:25,satellite:35,engine:50,watch:65},'Complete the 40-shift campaign. Shipping continues in endless contracts afterward.']
];
root.FactoryContent={metals,machines,outputs,alloys,missions};
if(typeof module!=='undefined'&&module.exports)module.exports=root.FactoryContent;
})(typeof globalThis!=='undefined'?globalThis:this);
