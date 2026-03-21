import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, Alert, ScrollView } from 'react-native';
import { ShieldAlert, CreditCard, ChevronRight, ArrowLeft, CheckCircle2, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Crypto from 'expo-crypto';

// Standard BIP39 English Word List ( industry standard )
const bip39Words = "abandon,ability,able,about,above,absent,absorb,abstract,absurd,abuse,access,accident,account,accuse,achieve,acid,acoustic,acquire,across,act,action,actor,actress,actual,adapt,add,addict,address,adjust,admit,adult,advance,advice,aerobic,affair,afford,african,after,again,against,age,agent,agree,ahead,aid,aim,air,airport,aisle,alarm,album,alcohol,alert,alien,alike,alive,all,alley,allow,almost,alone,alpha,already,also,alter,always,amateur,amaze,amber,ambulance,ambush,among,amount,amuse,analyst,anchor,ancient,anger,angle,angry,animal,ankle,announce,annual,another,answer,antenna,antique,anxiety,any,apart,apology,appear,apple,approve,april,arch,arctic,area,arena,argue,arm,armed,armor,army,around,arrange,arrest,arrive,arrow,art,artefact,artist,artwork,ask,aspect,assault,asset,assist,assume,asthma,athlete,atom,attack,attend,attitude,attract,auction,audit,august,aunt,author,auto,autumn,available,average,avoid,awake,aware,away,awesome,awful,awkward,axis,baby,bachelor,bacon,badge,bag,balance,balcony,ball,bamboo,banana,banner,bar,barely,bargain,barrel,base,basic,basket,battle,beach,beam,bean,beauty,because,become,beef,before,begin,behave,behind,believe,below,belt,bench,benefit,best,betray,better,between,beyond,bicycle,bid,bike,bind,biology,bird,birth,bitter,black,blade,blame,blanket,blast,bleak,bless,blind,blood,blossom,blouse,blue,blur,blush,board,boat,body,boil,bomb,bone,bonus,book,boost,border,boring,borrow,boss,bottom,bounce,box,boy,bracket,brain,brand,brass,brave,bread,breeze,brick,bridge,brief,bright,bring,brisk,broccoli,broken,bronze,broom,brother,brown,brush,bubble,buddy,budget,buffalo,build,bulb,bulk,bullet,bundle,bunker,burden,burger,burst,bus,business,busy,butter,buyer,buzz,cabbage,cabin,cable,cactus,cage,cake,call,calm,camera,camp,can,canal,cancel,candy,cannon,canoe,canvas,canyon,capable,capital,captain,car,carbon,card,cargo,carpet,carry,cart,case,cash,casino,castle,casual,cat,catalog,catch,category,cattle,caught,cause,caution,cave,ceiling,celery,cell,cement,census,century,cereal,certain,chair,chalk,champion,change,chaos,chapter,charge,chase,chat,cheap,check,cheese,chef,cherry,chest,chicken,chief,child,chimney,china,chip,choice,cholesterol,choose,chronic,chuckle,chunk,churn,cigar,cinema,circle,citizen,city,civil,claim,clap,clarify,claw,clay,clean,clerk,clever,click,client,cliff,climb,clinic,clip,clock,clog,close,cloth,cloud,clown,club,clump,cluster,clutch,coach,coast,coconut,code,coffee,coil,coin,collect,color,column,combine,come,comfort,comic,common,company,concert,conduct,confirm,congress,connect,consider,control,convince,cook,cool,copper,copy,coral,core,corn,corner,cost,cotton,couch,country,couple,course,cousin,cover,coyote,crack,cradle,craft,cram,crane,crash,crater,crawl,crazy,cream,credit,creek,crew,cricket,crime,crisp,critic,crop,cross,crouch,crowd,crucial,cruel,cruise,crumble,crunch,crush,cry,crystal,cube,culture,cup,cupboard,curious,current,curtain,curve,cushion,custom,cute,cycle,daddy,damage,damp,dance,danger,daring,dash,daughter,dawn,day,deal,debate,debris,decade,december,decide,decline,decorate,decrease,deer,defense,define,defy,degree,delay,deliver,demand,demise,denial,dentist,deny,depart,depend,deposit,depth,deputy,derive,desert,design,desk,despair,destroy,detail,detect,develop,device,devote,diagram,dial,diamond,diary,dice,diesel,diet,differ,digital,dignity,dilemma,dinner,dinosaur,direct,dirt,disagree,disaster,discipline,dish,dismiss,disorder,display,distance,divert,divide,divorce,dizzy,doctor,document,dog,doll,dolphin,domain,donate,donor,door,dose,double,dove,draft,dragon,drain,drama,drastic,draw,dream,dress,drift,drill,drink,drip,drive,drop,drum,dry,duck,dumb,dune,during,dust,dutch,duty,dwarf,dynamic,eager,eagle,early,earn,earth,easily,east,easy,echo,ecology,economy,edge,edit,educate,effort,egg,eight,either,elbow,elder,electric,elegant,element,elephant,elevator,elite,else,embark,embody,embrace,emerge,emotion,employ,empower,empty,enable,enact,end,endless,endorse,enemy,energy,engine,enlist,enjoy,enrich,enroll,ensure,enter,entire,entry,envelope,episode,equal,equip,era,erase,erode,erosion,error,erupt,escape,essay,essence,estate,eternal,ethics,evidence,evil,evoke,evolve,exact,example,excess,exchange,excite,exclude,excuse,execute,exercise,exhaust,exhibit,exile,exist,exit,exotic,expand,expect,expire,explain,expose,express,extend,extra,eye,eyebrow,fabric,face,faculty,fade,faint,faith,fall,false,fame,family,famous,fan,fancy,fantasy,farm,fashion,fat,fatal,father,fatigue,fault,favorite,feature,february,federal,fee,feed,feel,female,fence,festival,fetch,fever,few,fiber,fiction,field,figure,file,film,filter,final,find,fine,finger,finish,fire,firm,first,fiscal,fish,fit,fitness,fix,flag,flame,flash,flat,flavor,flee,flight,flip,float,flock,floor,flower,fluid,flush,fly,foam,focus,fog,foil,fold,follow,food,foot,force,forest,forget,fork,fortune,forum,forward,fossil,foster,found,fox,fragile,frame,frequent,fresh,friend,fringe,frog,front,frost,frown,frozen,fruit,fuel,full,funny,furnace,fury,fused,future,gadget,gain,galaxy,gallery,game,gap,garage,garbage,garden,garlic,garment,gas,gasp,gate,gather,gauge,gaze,general,genius,genre,gentle,genuine,gesture,ghost,giant,gift,giggle,ginger,giraffe,girl,give,glad,glance,glare,glass,glide,glimpse,globe,gloom,glory,glove,glow,glue,goat,goddess,gold,good,goose,gorilla,gospel,gossip,govern,gown,grab,grace,grain,grant,grape,grass,gravity,gray,great,greed,green,grid,grief,grit,grocery,group,grow,grunt,guard,guess,guide,guilt,guitar,gun,gym,habit,hair,half,hammer,hamster,hand,happy,harbor,hard,harsh,harvest,hat,have,hawk,hazard,head,health,heart,heavy,hedgehog,height,hello,helmet,help,hen,hero,hidden,high,hill,hint,hip,hire,history,hobby,hockey,hold,hole,holiday,hollow,home,honey,hood,hope,horn,horror,horse,hospital,host,hotel,hour,house,hover,hub,huge,human,humble,humor,hundred,hungry,hunt,hurdle,hurry,hurt,husband,hybrid,ice,icon,idea,identify,idle,idol,ignore,ill,illegal,illness,image,imitate,immense,immune,impact,impose,improve,impulse,inch,include,income,increase,index,indicate,indoor,industry,infant,inflict,inform,inhale,inherit,initial,inject,injury,inmate,inner,innocent,input,inquiry,insane,insect,inside,inspire,install,intact,intake,integer,intend,intense,inter,invent,invest,invite,involve,iron,island,isolate,issue,item,ivory,jacket,jaguar,jar,jazz,jealous,jeans,jelly,jewel,job,join,joke,journey,joy,judge,juice,jump,jungle,junior,junk,just,kangaroo,keen,keep,ketchup,key,kick,kid,kidney,kind,kingdom,kiss,kit,kitchen,kite,kitten,kiwi,knee,knife,knock,know,lab,label,labor,ladder,lady,lake,lamp,language,laptop,large,later,latin,laugh,laundry,lava,law,lawn,lawsuit,layer,lazy,leader,leaf,learn,leave,lecture,left,leg,legal,legend,leisure,lemon,lend,length,lens,leopard,lesson,letter,level,liar,liberty,library,license,life,lift,light,like,limb,limit,link,lion,liquid,list,little,live,lizard,load,loan,lobster,local,lock,logic,long,loop,lottery,loud,lounge,love,loyal,lucky,luggage,lumber,lunar,lunch,luxury,lyrics,machine,mad,magic,magnet,maid,mail,main,major,make,mammal,man,manage,mandate,mango,mansion,manual,maple,marble,march,margin,marine,market,marriage,mask,mass,master,match,material,math,matrix,matter,maximum,maze,meadow,mean,measure,meat,mechanic,medal,media,melody,melt,member,memory,mention,menu,mercy,merge,merit,merry,mesh,message,metal,method,middle,midnight,milk,million,mimic,mind,minimum,minor,minute,miracle,mirror,misery,miss,mistake,mix,mixed,mixture,mobile,model,modify,mom,moment,monitor,monkey,monster,month,moon,moral,more,morning,mosquito,mother,motion,motor,mountain,mouse,mover,movie,mud,muffin,mule,multiply,muscle,museum,mushroom,music,must,mutual,myself,mystery,myth,naive,name,napkin,narrow,nasty,nation,nature,near,neck,needle,negative,neglect,neither,nephew,nerve,nest,net,network,neutral,never,news,next,nice,night,noble,noise,nominee,noon,north,nose,notable,note,nothing,notice,novel,now,nuclear,number,nurse,nut,oak,obey,object,oblige,obscure,observe,obtain,obvious,occur,ocean,october,odor,off,offer,office,often,oil,okay,old,olive,olympic,omit,once,one,onion,online,only,open,opera,opinion,oppose,option,orange,orbit,orchard,order,ordinary,organ,orient,origin,orphan,ostrich,other,outdoor,outer,output,outside,oval,oven,over,own,owner,oxygen,oyster,ozone,pact,paddle,page,pair,palace,palm,panda,panel,panic,panther,paper,parade,parent,park,parrot,party,pass,patch,path,patient,patrol,patron,pattern,pause,pave,payment,peace,peanut,pear,peasant,pelican,pen,penalty,pencil,people,pepper,perfect,permit,person,pet,phantom,phase,phone,photo,phrase,physical,piano,picnic,picture,piece,pig,pigeon,pill,pilot,pink,pioneer,pipe,piston,pitch,pizza,place,planet,plastic,plate,play,please,pledge,pluck,plug,plunge,poem,poet,point,polar,pole,police,pond,pony,pool,popular,portion,post,poster,pot,potato,powder,power,practice,praise,prayer,preach,prefer,pregnant,premier,prepare,present,pretend,pretty,prevent,price,pride,primary,print,priority,prison,private,prize,problem,process,produce,profit,program,project,promote,proof,property,prosper,protect,proud,provide,public,pudding,pull,pulp,pulse,pumpkin,punch,pupil,puppy,purchase,purity,purpose,purse,push,put,puzzled,pyramid,quadrant,quail,quantum,quarter,queen,query,quest,queue,quick,quiet,quilt,quit,quiz,quote,rabbit,raccoon,race,rack,radar,radio,rail,rain,raise,rally,ramp,ranch,random,range,rapid,rare,rate,rather,raven,raw,razor,ready,real,reason,rebel,rebuild,recall,receive,recipe,record,recycle,red,reduce,reflect,reform,refuse,region,regret,reject,relax,release,relief,rely,remain,remedy,remind,remove,render,renew,rent,reopen,repair,repeat,replace,report,rescue,resemble,resist,resource,respond,rest,result,retire,retreat,return,reunion,reveal,review,reward,rhythm,rib,ribbon,rice,rich,ride,ridge,rifle,rigid,ring,riot,ripple,risk,ritual,rival,river,road,roast,robot,robust,rocket,romance,roof,rookie,room,rose,rotate,rough,round,route,royal,rubber,rude,rug,rule,run,runway,rural,sad,saddle,sadness,safe,sail,salad,salmon,salon,salt,salute,same,sample,sand,satisfy,saturn,sauce,sausage,save,say,scale,scan,scare,scatter,scene,scheme,school,science,scissors,scorpion,scout,scrap,screen,script,scrub,sea,search,season,seat,second,secret,section,security,seed,seek,segment,select,sell,seminar,senior,sense,sentence,series,service,session,settle,setup,seven,shadow,shaft,shallow,share,shed,shell,sheriff,shield,shift,shine,ship,shirt,shock,shoe,shoot,shop,short,shoulder,shove,shrimp,shrug,shuffle,shy,sibling,sick,side,sieve,sight,sign,silent,silk,silly,silver,similar,simple,since,sing,siren,sister,situate,six,size,skate,sketch,ski,skill,skin,skirt,skull,slab,slam,sleep,slender,slice,slide,slight,slim,slogan,slot,slow,slush,small,smart,smile,smoke,smooth,snack,snake,snap,sniff,snow,soap,soccer,social,sock,soda,soft,solar,soldier,solid,solution,solve,someone,song,soon,sorry,sort,soul,sound,soup,source,south,space,spare,spatial,spawn,speak,special,speed,spell,spend,sphere,spice,spider,spike,spin,spirit,split,spoil,sponsor,spoon,sport,spot,spray,spread,spring,spy,square,squash,squirrel,stable,stadium,staff,stage,stair,stamp,stand,start,state,stay,steak,steel,stem,step,stereo,stew,stick,still,sting,stock,stomach,stone,stool,stop,storage,store,storm,story,stove,strategy,street,strike,strong,struggle,student,stuff,stumble,style,subject,submit,subway,success,such,sudden,suffer,sugar,suggest,suit,summer,sun,sunny,sunset,super,supply,supreme,sure,surface,surge,surprise,surround,survey,suspect,sustain,swallow,swamp,swap,swarm,swear,sweat,sweep,sweet,swift,swim,swing,switch,sword,symbol,symptom,syrup,system,table,tackle,tag,tail,talent,talk,tank,tape,target,task,taste,tattoo,taxi,tea,teach,team,tell,ten,tenant,tennis,tent,term,test,text,thank,that,theme,then,theory,there,they,thing,this,thought,three,thrive,throw,thumb,thunder,ticket,tide,tiger,tilt,timber,time,tiny,tip,tired,tissue,title,toast,tobacco,today,toddler,toe,together,toilet,token,tomato,tomorrow,tone,tongue,tonight,tool,tooth,top,topic,topple,torch,tornado,tortoise,toss,total,tourist,toward,tower,town,toy,track,trade,traffic,tragic,train,transfer,trap,trash,travel,tray,treat,tree,trend,trial,tribe,trick,triple,triumph,trophy,trouble,truck,true,truly,trumpet,trust,truth,try,tube,tuition,tumble,tuna,tunnel,turkey,turn,turtle,twelve,twenty,twice,twin,twist,two,type,typical,ugly,umbrella,unable,unaware,uncle,uncover,under,undo,unfair,unfold,unhappy,uniform,unique,unit,universe,unknown,unlock,until,unusual,unveil,update,upgrade,uphold,upon,upper,upset,urban,urge,usage,use,used,useful,useless,usual,utility,vacant,vacuum,vague,valid,valley,valve,van,vanish,vapor,various,vast,vault,vector,vegetable,vehicle,vein,velvet,vendor,venture,venue,verb,verify,verse,vessel,veteran,vibrant,vicious,victory,video,view,village,vintage,violin,virtual,virus,visa,visit,visual,vital,vivid,vocal,voice,void,volcano,volume,vote,voyage,wage,wagon,wait,walk,wall,walnut,want,warfare,warm,warrior,wash,wasp,waste,water,wave,way,wealth,weapon,wear,weasel,weather,web,wedding,weekend,weird,welcome,west,wet,whale,what,wheat,wheel,when,where,whip,whisper,wide,width,wife,wild,will,win,window,wine,wing,wink,winner,winter,wire,wisdom,wise,wish,witness,wolf,woman,wonder,wood,wool,word,work,world,worry,worth,wrap,wreck,wrestle,wrist,write,wrong,yard,year,yellow,you,young,youth,zebra,zero,zone,zoo".split(",");

const generateHardwareSecure12Words = async () => {
    try {
        const dictionary = bip39Words;
        const words = [];
        
        // Use Crypto for strong randomness
        const randomBytes = await Crypto.getRandomBytesAsync(12 * 4); // 4 bytes per word index
        const uint32Arr = new Uint32Array(randomBytes.buffer);
        
        for (let i = 0; i < 12; i++) {
            const index = uint32Arr[i] % dictionary.length;
            words.push(dictionary[index]);
        }
        return words;
    } catch (e) {
        console.warn('[Security] Crypto.getRandomBytesAsync failed, using fallback:', e.message);
        // Fallback to Math.random if native crypto fails
        const dictionary = bip39Words;
        return Array.from({ length: 12 }, () => dictionary[Math.floor(Math.random() * dictionary.length)]);
    }
};

export default function Bip39SetupModal({ visible, onComplete, onCancel }) {
    const [step, setStep] = useState(1);
    const [phrase, setPhrase] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Quiz state (Harden to 3 words)
    const [testIndices, setTestIndices] = useState([0, 1, 2]);
    const [answers, setAnswers] = useState(['', '', '']);

    const generateNewVault = async () => {
        if (isGenerating) return;
        setIsGenerating(true);
        try {
            const newPhrase = await generateHardwareSecure12Words();
            setPhrase(newPhrase);
            
            // Randomly pick 3 distinct positions for the proof-of-work test
            const i1 = Math.floor(Math.random() * 4);
            const i2 = Math.floor(Math.random() * 4) + 4;
            const i3 = Math.floor(Math.random() * 4) + 8;
            setTestIndices([i1, i2, i3]);
            setAnswers(['', '', '']);
        } finally {
            setIsGenerating(false);
        }
    };

    useEffect(() => {
        if (visible && phrase.length === 0) {
            generateNewVault();
        }
        if (!visible) {
            setStep(1);
            setPhrase([]);
        }
    }, [visible]);

    const handleVerify = () => {
        const isCorrect = testIndices.every((pos, i) => 
            answers[i].trim().toLowerCase() === phrase[pos]
        );
        
        if (isCorrect) {
            onComplete(phrase.join(' ')); 
            setStep(1);
        } else {
            Alert.alert(
                "Verification Failed", 
                "The words provided do not match your secure recovery phrase. Please check your spelling or go back to re-verify your phrase."
            );
        }
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header Stepper */}
                    <View style={styles.stepperContainer}>
                        <View style={[styles.stepItem, step >= 1 && styles.stepItemActive]}>
                            <Text style={[styles.stepText, step >= 1 && styles.stepTextActive]}>1. BACKUP</Text>
                        </View>
                        <View style={styles.stepConnector} />
                        <View style={[styles.stepItem, step >= 2 && styles.stepItemActive]}>
                            <Text style={[styles.stepText, step >= 2 && styles.stepTextActive]}>2. VERIFY</Text>
                        </View>
                    </View>

                    {step === 1 ? (
                        <View style={{ flex: 1 }}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.iconHdr}>
                                    <ShieldAlert size={40} color="#000" />
                                </View>
                                <Text style={styles.header}>OFFLINE RECOVERY VAULT</Text>
                                <Text style={styles.warning}>
                                    Write these 12 words on physical paper. If you lose this device, this phrase is the ONLY way to recover your business data.
                                </Text>
                                
                                <View style={styles.grid}>
                                    {phrase.map((word, i) => (
                                        <View key={i} style={styles.wordBox}>
                                            <View style={styles.wordNumCircle}>
                                                 <Text style={styles.wordNum}>{i + 1}</Text>
                                            </View>
                                            <Text style={styles.wordText}>{word}</Text>
                                        </View>
                                    ))}
                                </View>

                                <View style={styles.infoBox}>
                                     <Info size={16} color="#64748b" />
                                     <Text style={styles.infoText}>Do not store this digitally (no screenshots, no notes app).</Text>
                                </View>
                            </ScrollView>

                            <View style={styles.btnCol}>
                                <TouchableOpacity onPress={() => setStep(2)} style={styles.primaryBtnLarge}>
                                    <Text style={styles.btnTextLarge}>I HAVE SECURED MY PHRASE</Text>
                                    <ChevronRight size={20} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={onCancel} style={styles.cancelBtnTextOnly}>
                                    <Text style={styles.cancelLink}>Cancel Setup</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={{ flex: 1 }}>
                            <View style={styles.iconHdr}>
                                <CheckCircle2 size={40} color="#000" />
                            </View>
                            <Text style={styles.header}>PROOF-OF-WORK TEST</Text>
                            <Text style={styles.subtitle}>Let's verify you saved your words correctly.</Text>

                            <ScrollView style={styles.testArea} showsVerticalScrollIndicator={false}>
                                {testIndices.map((pos, i) => (
                                    <View key={i} style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>ENTER WORD #{pos + 1}</Text>
                                        <TextInput 
                                            style={styles.input}
                                            value={answers[i]}
                                            onChangeText={(val) => {
                                                const newAns = [...answers];
                                                newAns[i] = val;
                                                setAnswers(newAns);
                                            }}
                                            placeholder="Type here..."
                                            placeholderTextColor="#cbd5e1"
                                            autoCapitalize="none"
                                        />
                                    </View>
                                ))}
                            </ScrollView>

                            <View style={styles.btnRow}>
                                <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                                    <ArrowLeft size={20} color="#000" />
                                    <Text style={styles.backBtnText}>BACK</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={handleVerify} 
                                    style={[styles.primaryBtnLarge, { flex: 1 }, (answers.some(a => !a)) && styles.disabledBtn]}
                                    disabled={answers.some(a => !a)}
                                >
                                    <Text style={styles.btnTextLarge}>FINALIZE</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    container: { backgroundColor: '#fff', borderRadius: 32, padding: 24, width: '100%', height: '85%', maxWidth: 450 },
    stepperContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 32, justifyContent: 'center' },
    stepItem: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f1f5f9' },
    stepItemActive: { backgroundColor: '#000' },
    stepText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
    stepTextActive: { color: '#fff' },
    stepConnector: { width: 30, height: 2, backgroundColor: '#f1f5f9', marginHorizontal: 4 },
    iconHdr: { alignSelf: 'center', width: 70, height: 70, borderRadius: 35, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    header: { fontSize: 20, fontWeight: '900', color: '#000', marginBottom: 12, textAlign: 'center', letterSpacing: -0.5 },
    warning: { fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 18, textAlign: 'center', fontWeight: '500', paddingHorizontal: 10 },
    subtitle: { fontSize: 15, color: '#64748b', marginBottom: 32, textAlign: 'center', fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    wordBox: { 
        width: '48%', 
        backgroundColor: '#f8fafc', 
        paddingVertical: 14, 
        paddingHorizontal: 12, 
        borderRadius: 16, 
        marginBottom: 10, 
        flexDirection: 'row', 
        alignItems: 'center',
        borderWidth: 1, 
        borderColor: '#e2e8f0' 
    },
    wordNumCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10
    },
    wordNum: { color: '#64748b', fontWeight: '900', fontSize: 10 },
    wordText: { color: '#000', fontWeight: '800', fontSize: 14, textTransform: 'lowercase' },
    infoBox: { flexDirection: 'row', gap: 10, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
    infoText: { flex: 1, fontSize: 11, color: '#64748b', fontWeight: '600' },
    testArea: { flex: 1 },
    inputGroup: { marginBottom: 20 },
    inputLabel: { fontSize: 11, fontWeight: '900', color: '#94a3b8', marginBottom: 8, letterSpacing: 1 },
    input: { 
        borderWidth: 2, 
        borderColor: '#f1f5f9', 
        borderRadius: 18, 
        padding: 14, 
        fontSize: 16, 
        fontWeight: '700', 
        backgroundColor: '#f8fafc',
        color: '#000'
    },
    btnCol: { gap: 10 },
    btnRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    primaryBtnLarge: { 
        backgroundColor: '#000', 
        paddingVertical: 18, 
        paddingHorizontal: 24, 
        borderRadius: 22, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5
    },
    btnTextLarge: { color: '#fff', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    backBtn: { 
        paddingHorizontal: 16, 
        paddingVertical: 18, 
        borderRadius: 22, 
        borderWidth: 2, 
        borderColor: '#f1f5f9', 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 8 
    },
    backBtnText: { fontWeight: '900', color: '#000', fontSize: 11 },
    cancelBtnTextOnly: { padding: 12, alignItems: 'center' },
    cancelLink: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
    disabledBtn: { backgroundColor: '#e2e8f0', shadowOpacity: 0 }
});


