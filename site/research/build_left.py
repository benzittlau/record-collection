import json, pathlib
P=pathlib.Path('site/research/left.json')
# Each row records one visible sleeve, ordered by compartment and from left to right.
upper='''Silk Degrees|Boz Scaggs|1976|confirmed|JC 33920 · BOZ SCAGGS · SILK DEGREES
Shakti with John McLaughlin|Shakti|1976|confirmed|KC 34167 · SHAKTI — WITH JOHN McLAUGHLIN
953 West|The Siegel-Schwall Band|1973|confirmed|BWL1-0121 · 953 WEST — THE SIEGEL-SCHWALL BAND
A Handful of Beauty|Shakti|1976|confirmed|PC 34372 · SHAKTI WITH JOHN McLAUGHLIN · A HANDFUL OF BEAUTY
Anthology|Steve Miller Band|1972|confirmed|STEVE MILLER BAND · ANTHOLOGY · SVBB-11114
Unidentified sleeve|Unidentified||unknown|Worn dark brown spine; text not legible
Unidentified sleeve|Unidentified||unknown|Olive green spine · LITHO IN CANADA · ABC RECORDS INC.
The Hissing of Summer Lawns|Joni Mitchell|1975|confirmed|ASYLUM 7ES-1051 · JONI MITCHELL · THE HISSING OF SUMMER LAWNS
Steppin'|The Pointer Sisters|1975|confirmed|9307-6021 · STEPPIN' · THE POINTER SISTERS
Imaginary Voyage|Jean-Luc Ponty|1976|confirmed|JEAN-LUC PONTY · IMAGINARY VOYAGE · ATLANTIC SD 18195
Avalon|Roxy Music|1982|confirmed|ROXY MUSIC AVALON · 92 36861 · WARNER BROS. / E.G.
Pretenders|Pretenders|1980|confirmed|QSR 6083 · PRETENDERS · SIRE RECORDS COMPANY
Two Lane Highway|Pure Prairie League|1975|confirmed|APL1-0933 · TWO LANE HIGHWAY — PURE PRAIRIE LEAGUE
Initiation|Todd Rundgren|1975|confirmed|BR 6957 · TODD RUNDGREN / INITIATION · BEARSVILLE RECORDS
Tubular Bells|Mike Oldfield|1973|confirmed|TUBULAR BELLS · MIKE OLDFIELD · VIRGIN RECORDS VR 13-105
The Magazine|Rickie Lee Jones|1984|confirmed|RICKIE LEE JONES · THE MAGAZINE · 92 51171
Seven|Poco|1974|confirmed|KE 32895 · POCO · SEVEN · EPIC STEREO
Maria Muldaur|Maria Muldaur|1973|confirmed|MS 2148 · MARIA MULDAUR · ©1973 WARNER BROS.
If I Could Only Remember My Name|David Crosby|1971|confirmed|DAVID CROSBY · ATLANTIC SD 7220
Unidentified sleeve|Unidentified||unknown|Worn black spine between David Crosby and Sad Café
Facades|Sad Café|1979|confirmed|SAD CAFE · FACADES · A&M SP-4779 · ℗1979
Country Life|Roxy Music|1974|confirmed|ROXY MUSIC · COUNTRY LIFE · ATCO SD 36-106
The Dark Side of the Moon|Pink Floyd|1973|confirmed|PINK FLOYD · THE DARK SIDE OF THE MOON · SMAS-11163
Wish You Were Here|Pink Floyd|1975|confirmed|PC 33453 · PINK FLOYD · WISH YOU WERE HERE · ℗1975
December's Children (And Everybody's)|The Rolling Stones|1965|confirmed|DECEMBER'S CHILDREN (AND EVERYBODY'S) · ROLLING STONES
Beggars Banquet|The Rolling Stones|1968|confirmed|PS 539 · Rolling Stones Beggars Banquet · London
Todd Rundgren's Utopia|Utopia|1974|confirmed|BR 6954 · TODD RUNDGREN'S UTOPIA · BEARSVILLE RECORDS · ℗1974
Let It Bleed|The Rolling Stones|1969|probable|LONDON · NPS-4 · STEREO
Through the Past, Darkly (Big Hits Vol. 2)|The Rolling Stones|1969|probable|LONDON · NPS-2
Byrds|The Byrds|1973|probable|ASYLUM · SD 5058 · partially legible BYRDS
Love You Live|The Rolling Stones|1977|confirmed|THE ROLLING STONES · LOVE YOU LIVE · COC 2-9001
Faithful|Todd Rundgren|1976|confirmed|BR 6963 · FAITHFUL · TODD RUNDGREN · ℗1976
Prisoner in Disguise|Linda Ronstadt|1975|confirmed|LINDA RONSTADT / PRISONER IN DISGUISE
Stop All That Jazz|Leon Russell|1974|confirmed|STOP ALL THAT JAZZ · LEON RUSSELL · SR 2110 · SHELTER
Todd|Todd Rundgren|1974|confirmed|TODD RUNDGREN / TODD · BEARSVILLE 2D58 · ℗1974
Unidentified sleeve|Unidentified||unknown|Bright blue spine, extensively worn; no readable title
Born in the U.S.A.|Bruce Springsteen|1984|confirmed|BORN IN THE U.S.A. · BRUCE SPRINGSTEEN · E 84 · COLUMBIA
Natural Elements|Shakti|1977|confirmed|PC 34980 · SHAKTI WITH JOHN McLAUGHLIN · NATURAL ELEMENTS
Demon in Disguise|David Bromberg|1972|confirmed|DAVID BROMBERG · DEMON IN DISGUISE · COLUMBIA
Unidentified sleeve|Unidentified||unknown|Thin worn dark sleeve with COLUMBIA STEREO; title obscured
Another Grey Area|Graham Parker|1982|confirmed|GRAHAM PARKER / ANOTHER GREY AREA · ARISTA AL 9589
Heartbeat City|The Cars|1984|confirmed|96 02961 · ELEKTRA · illustrated gatefold spine
Pastiche|The Manhattan Transfer|1978|confirmed|THE MANHATTAN TRANSFER · PASTICHE · ATLANTIC KSD 19163
Over-Nite Sensation|The Mothers of Invention|1973|confirmed|MS 2149 · THE MOTHERS / OVER-NITE SENSATION
Selling England by the Pound|Genesis|1973|confirmed|GENESIS · SELLING ENGLAND BY THE POUND · FC 6060
Floating World|Jade Warrior|1974|confirmed|JADE WARRIOR · FLOATING WORLD · ILPS 9290
Aja|Steely Dan|1977|confirmed|9022-1006 · STEELY DAN · AJA · ABC RECORDS
Fragile|Yes|1971|confirmed|YES · FRAGILE · ATLANTIC SD 7211
The Best of OMD|Orchestral Manoeuvres in the Dark|1988|confirmed|VL 2454 · ORCHESTRAL MANOEUVRES IN THE DARK · THE BEST OF OMD
Can't Buy a Thrill|Steely Dan|1972|probable|ABCX 758 · partially legible THRILL
Jazz|Queen|1978|confirmed|QUEEN JAZZ · ELEKTRA 6E-166
No Stranger to Danger|Payola$|1982|probable|…OLAS · NO STRANGER TO DANGER · ℗1982 A&M
The Up Escalator|Graham Parker|1980|confirmed|GRAHAM PARKER · THE UP ESCALATOR · ARISTA AL 9517
Construction #1|Ten Wheel Drive with Genya Ravan|1969|probable|…STRUCTION NO.1 · POLYDOR 543 112
The Pointer Sisters|The Pointer Sisters|1973|confirmed|BTS 48 · THE POINTER SISTERS · THE POINTER SISTERS
Between the Buttons|The Rolling Stones|1967|probable|…THE BUTTONS · THE ROLLING STONES · LONDON · PS 499
Bruised Orange|John Prine|1978|confirmed|JOHN PRINE · BRUISED ORANGE · ASYLUM 6E-139
No Guru, No Method, No Teacher|Van Morrison|1986|confirmed|VAN MORRISON · NO GURU, NO METHOD, NO TEACHER · MERCURY 830 077-1
Somewhere in England|George Harrison|1981|confirmed|GEORGE HARRISON · SOMEWHERE IN ENGLAND · DARK HORSE
Magical Mystery Tour|The Beatles|1967|confirmed|MAGICAL MYSTERY TOUR · THE BEATLES · SW-891'''
lower='''Mistaken Identity|Kim Carnes|1981|confirmed|SO-17052 · KIM CARNES · MISTAKEN IDENTITY
Deodato 2|Deodato|1973|confirmed|DEODATO 2 · CTI RECORDS
Listen|A Flock of Seagulls|1983|confirmed|A FLOCK OF SEAGULLS · LISTEN · … N 68006
The Freewheelin' Bob Dylan|Bob Dylan|1963|confirmed|KCS 8786 · BOB DYLAN · THE FREEWHEELIN' BOB DYLAN
Unknown title|Dan Hicks & His Hot Licks||unknown|DAN HICKS & HIS HOT LICKS · … 64; title not visible
Longer Fuse|Dan Hill|1977|confirmed|9230-1073 · LONGER FUSE · DAN HILL
Unknown title|Van der Graaf Generator||unknown|THE FAMOUS CHARISMA LABEL · partial VAN DER GRAAF; title unclear
Broken English|Marianne Faithfull|1979|confirmed|ILPS 9570 · MARIANNE FAITHFULL · BROKEN ENGLISH · ℗1979
Ambient 1: Music for Airports|Brian Eno|1978|confirmed|AMBIENT #1 MUSIC FOR AIRPORTS · BRIAN ENO · PB 2006
Trilogy|Emerson, Lake & Palmer|1972|confirmed|EMERSON LAKE & PALMER · TRILOGY
Desperado|Eagles|1973|probable|Eagles / Asylum · SD 5068 (partially legible)
Unidentified sleeve|Unidentified||unknown|Worn black sleeve between Eagles and Jimi Hendrix
Electric Ladyland|The Jimi Hendrix Experience|1968|confirmed|2RS 6307 · JIMI HENDRIX EXPERIENCE · ELECTRIC LADYLAND
461 Ocean Boulevard|Eric Clapton|1974|confirmed|461 OCEAN BOULEVARD · ERIC CLAPTON
Door to Door|The Cars|1987|confirmed|THE CARS — DOOR TO DOOR · ELEKTRA 96-07471
Freedom of Choice|Devo|1980|confirmed|XBS-3435 · DEVO · FREEDOM OF CHOICE · ℗1980
Unknown title|Carlos Santana||unknown|… CARLOS · COLUMBIA STEREO; heavily torn black spine
Unidentified sleeve|Unidentified||unknown|Worn cream sleeve with handwriting; title obscured
Gentle on My Mind and Other Originals by John Hartford|John Hartford|1967|confirmed|LSP-4068 · GENTLE ON MY MIND AND OTHER ORIGINALS BY JOHN HARTFORD
Freeze-Frame|The J. Geils Band|1981|confirmed|SOO-17062 · THE J. GEILS BAND · FREEZE-FRAME
Eldorado|Electric Light Orchestra|1974|confirmed|A SYMPHONY BY THE ELECTRIC LIGHT ORCHESTRA · ELDORADO
Love Over Gold|Dire Straits|1982|confirmed|LOVE OVER GOLD · DIRE STRAITS
Doc at the Radar Station|Captain Beefheart and the Magic Band|1980|confirmed|DOC AT THE RADAR STATION · CAPTAIN BEEFHEART AND THE MAGIC BAND
13|The Doors|1970|confirmed|EKS-74079 · THE DOORS / 13
Communiqué|Dire Straits|1979|confirmed|COMMUNIQUE · DIRE STRAITS · MERCURY SRM 1-3791
Animal Notes|Crack the Sky|1976|confirmed|CRACK THE SKY / ANIMAL NOTES · LIFESONG LS6005
Tusk|Fleetwood Mac|1979|confirmed|2HS 3350 · FLEETWOOD MAC · TUSK · ℗1979
Fleetwood Mac|Fleetwood Mac|1975|confirmed|MS 2225 · FLEETWOOD MAC · FLEETWOOD MAC · ℗1975
Cunning Stunts|Caravan|1975|confirmed|9188-5000 · CUNNING STUNTS / CARAVAN
Shakedown Street|Grateful Dead|1978|confirmed|… SHAKEDOWN STREET · GRATEFUL DEAD · ARISTA
Emotional Rescue|The Rolling Stones|1980|confirmed|THE ROLLING STONES · EMOTIONAL RESCUE
Darkness on the Edge of Town|Bruce Springsteen|1978|confirmed|… SPRINGSTEEN · … EDGE OF TOWN · COLUMBIA
Duty Now for the Future|Devo|1979|confirmed|QBS 3337 · DEVO / DUTY NOW FOR THE FUTURE · ℗1979
Dangerous Acquaintances|Marianne Faithfull|1981|confirmed|XILP-9648 · MARIANNE FAITHFULL · DANGEROUS ACQUAINTANCES · ℗1981
John Denver's Greatest Hits, Volume 2|John Denver|1977|confirmed|CPL1-2195 · JOHN DENVER'S GREATEST HITS VOL.2
No Respect|Rodney Dangerfield|1980|confirmed|RODNEY DANGERFIELD · NO RESPECT
The Trouble with Normal|Bruce Cockburn|1983|confirmed|BRUCE COCKBURN · THE TROUBLE WITH NORMAL · C 83
Plays On|Climax Blues Band|1969|confirmed|The Climax Chicago Blues Band Plays On
Desire|Bob Dylan|1976|confirmed|PC 33893 · BOB DYLAN · DESIRE
Bringing It All Back Home|Bob Dylan|1965|confirmed|KCS 9128 · BOB DYLAN · BRINGING IT ALL BACK HOME
A Flock of Seagulls|A Flock of Seagulls|1982|confirmed|JV 6600 · A FLOCK OF SEAGULLS · JIVE RECORDS
Brothers in Arms|Dire Straits|1985|confirmed|VERTIGO VOG 1 3357 · BROTHERS IN ARMS · DIRE STRAITS
Inner Worlds|Mahavishnu Orchestra|1976|confirmed|KC 33908 · MAHAVISHNU ORCHESTRA / JOHN McLAUGHLIN · INNER WORLDS
Before the Flood|Bob Dylan and The Band|1974|probable|BOB DYLAN / THE BAND · ASYLUM RECORDS AB 201
Unidentified sleeve|Unidentified||unknown|Almost completely flaked black-and-white spine · ©1974 WARNER BROS.
Neiges|André Gagnon|1975|confirmed|ANDRÉ GAGNON · NEIGES
Unidentified sleeve|Unidentified||unknown|Pale sleeve following André Gagnon; no readable title
Unknown title|David Bromberg||unknown|DAVID BROMBERG · ST 114; title not visible
Humans|Bruce Cockburn|1980|confirmed|BRUCE COCKBURN HUMANS · SR 2107 SHELTER RECORDS
Unidentified sleeve|Unidentified||unknown|Worn blue-gray spine · fragment TOM…? NORTH…?
Pat Garrett & Billy the Kid|Bob Dylan|1973|confirmed|BOB DYLAN / PAT GARRETT & BILLY THE KID · ORIGINAL SOUNDTRACK RECORDING
Never for Ever|Kate Bush|1980|confirmed|KATE BUSH · NEVER FOR EVER · ST-11793
Unknown title|The Third Ear Band||unknown|THE THIRD … BAND · … SECRET…?; title damaged
The Black-Man's Burdon|Eric Burdon and War|1970|confirmed|SE-4710-2 · ERIC BURDON AND WAR · THE BLACK-MAN'S BURDON
Everybody Knows This Is Nowhere|Neil Young & Crazy Horse|1969|confirmed|NEIL YOUNG with CRAZY HORSE · EVERYBODY KNOWS THIS IS NOWHERE
They Only Come Out at Night|The Edgar Winter Group|1972|confirmed|THE EDGAR WINTER GROUP · THEY ONLY COME OUT AT NIGHT · EPIC
Unknown title|Pure Prairie League||unknown|PURE PRAIRIE LEAGUE · RCA; title illegible
Slow Train Coming|Bob Dylan|1979|confirmed|PC 36120 · BOB DYLAN · SLOW TRAIN COMING
Blonde on Blonde|Bob Dylan|1966|confirmed|C2S 841 · BOB DYLAN · BLONDE ON BLONDE
Self Portrait|Bob Dylan|1970|confirmed|C2X 30050 · BOB DYLAN · SELF PORTRAIT
Unidentified sleeve|Unidentified||unknown|Narrow pale-yellow sleeve between Self Portrait and Planet Waves
Planet Waves|Bob Dylan|1974|confirmed|BOB DYLAN / PLANET WAVES · ASYLUM RECORDS 7ES-1003
Blood on the Tracks|Bob Dylan|1975|confirmed|PC 33235 · BOB DYLAN · BLOOD ON THE TRACKS
Nashville Skyline|Bob Dylan|1969|confirmed|KCS 9825 · BOB DYLAN · NASHVILLE SKYLINE
Boys and Girls|Bryan Ferry|1985|confirmed|BRYAN FERRY · Boys and Girls · 92 55981
A Child's Adventure|Marianne Faithfull|1983|confirmed|MARIANNE FAITHFULL · A CHILD'S ADVENTURE · ISLAND 79 00661'''
rows=[]
for box,data,counts,photo in [('upper-left',upper,[23,20,17],'IMG_3569.jpg'),('lower-left',lower,[21,24,21],'IMG_3571.jpg')]:
 for index,line in enumerate(data.splitlines(),1):
  title,artist,year,confidence,spine=line.split('|')
  c=1 if index<=counts[0] else (2 if index<=sum(counts[:2]) else 3)
  local=index-(sum(counts[:c-1]) if c>1 else 0)
  notes='Album identity read from the photographed spine; the exact pressing and sleeve edition have not been verified.'
  if confidence=='unknown': notes='Identity remains unresolved from this photograph. Placeholder preserves the observed sleeve position. A clearer front-cover photo is needed.'
  elif confidence=='probable': notes='Probable album identity from partial spine text/catalogue number. Needs a front-cover photo to confirm; exact pressing unverified.'
  rows.append(dict(id=f'{box}-{index:02}',box=box,position=index,compartment=c,compartmentPosition=local,title=title,artist=artist,year=int(year) if year else None,confidence=confidence,spineText=spine,photo=photo,notes=notes,coverUrl=None,coverPath=None,backUrl=None,spotifyId=None,sources=[]))
P.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(len(rows), 'rows; counts', {b:sum(r['box']==b for r in rows) for b in ['upper-left','lower-left']})
