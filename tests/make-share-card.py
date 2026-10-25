from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
B='/usr/share/fonts/truetype/sand-box/google/Barlow Condensed/'
im=Image.open('/tmp/card-raw-0.png').convert('RGB').resize((1200,630),Image.LANCZOS)
W,H=im.size
# left-side darkening gradient for legibility + vignette
ov=Image.new('L',(W,H),0); d=ImageDraw.Draw(ov)
for x in range(W):
    a=int(max(0,1-x/640)**1.6*190); d.line([(x,0),(x,H)],fill=a)
dark=Image.new('RGB',(W,H),(8,6,10)); im=Image.composite(dark,im,ov)
vg=Image.new('L',(W,H),0); dv=ImageDraw.Draw(vg); dv.ellipse((-260,-200,W+260,H+200),fill=255); vg=vg.filter(ImageFilter.GaussianBlur(120))
im=Image.composite(im,Image.new('RGB',(W,H),(6,4,6)),vg)
# grain
random.seed(7); g=Image.effect_noise((W,H),28).convert('RGB'); im=Image.blend(im,Image.composite(g,im,Image.new('L',(W,H),40)),1.0)
dr=ImageDraw.Draw(im)
fT=ImageFont.truetype(B+'BarlowCondensed-Bold.ttf',92); fS=ImageFont.truetype(B+'BarlowCondensed-SemiBold.ttf',32); fU=ImageFont.truetype(B+'BarlowCondensed-Medium.ttf',28)
def txt(xy,s,f,fill):
    dr.text((xy[0]+3,xy[1]+3),s,font=f,fill=(0,0,0)); dr.text(xy,s,font=f,fill=fill)
txt((58,62),'SOLAR SYSTEM',fT,(245,240,232)); txt((58,148),'EXPLORER',fT,(255,122,48))
dr.rectangle((60,256,200,261),fill=(255,122,48))
txt((58,282),'Land on Mars. Fly a thruster rover.',fS,(236,228,218))
txt((58,320),'Bolt a rail gun to it. Raise hell.',fS,(236,228,218))
# pill
dr.rounded_rectangle((58,520,470,566),radius=23,fill=(14,12,16),outline=(255,122,48),width=2)
dr.text((80,526),'FREE  ·  PLAYS IN YOUR BROWSER  ·  NO APP STORE',font=ImageFont.truetype(B+'BarlowCondensed-SemiBold.ttf',24),fill=(255,214,170))
txt((60,576),'kaskel87-a11y.github.io/solar-system',fU,(190,184,176))
im.save('/workspace/solar-system/share-card.jpg',quality=86,optimize=True,progressive=True)
print(im.size)
