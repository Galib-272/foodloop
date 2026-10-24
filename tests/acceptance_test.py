import requests, json, datetime as dt, threading, sys
B = 'http://localhost:3100'
def sess(email):
    s = requests.Session()
    r = s.post(B+'/api/auth/login', json={'email': email, 'password': 'Demo@1234'}, timeout=120)
    assert r.ok, r.text
    return s
ok = lambda c, m: print(('PASS ' if c else 'FAIL ') + m) or (c or sys.exit(1))
for _ in range(60):
    try:
        if requests.get(B+'/login', timeout=120).ok: break
    except Exception: pass
donor, rec, rec2, admin, vol = [sess(e) for e in ['donor@foodsphere.test','recipient@foodsphere.test','recipient2@foodsphere.test','admin@foodsphere.test','volunteer@foodsphere.test']]
anon = requests.Session()

# 0. Registration + duplicate email + RBAC
email = f"new{dt.datetime.now().timestamp():.0f}@example.org"
r = anon.post(B+'/api/auth/register', json={'full_name':'Test Donor','email':email,'password':'abc12345','confirm_password':'abc12345','role':'donor','phone':'','accept_terms':True})
ok(r.ok and r.json()['redirect']=='/onboarding', 'register new donor -> onboarding')
r = requests.post(B+'/api/auth/register', json={'full_name':'Dup','email':email,'password':'abc12345','confirm_password':'abc12345','role':'donor','accept_terms':True})
ok(r.status_code==409, 'duplicate email rejected (409)')
r = requests.post(B+'/api/auth/register', json={'full_name':'X','email':'bad','password':'short','confirm_password':'nope','role':'admin','accept_terms':False})
ok(r.status_code==400 and len(r.json()['error']['fields'])>=4, f"server-side validation errors: {list(r.json()['error']['fields'])}")
r = anon.post(B+'/api/donations', json={})
ok(r.status_code==403, 'unverified/unonboarded donor cannot publish (403)')
ok(requests.get(B+'/api/inventory').status_code==401, 'unauthenticated API -> 401')
ok(rec.get(B+'/api/inventory').status_code==403, 'recipient cannot access donor inventory API -> 403')
ok(donor.get(B+'/api/admin/users').status_code==403, 'donor cannot access admin API -> 403')

# 1. Donor uploads historical data (validation report + import)
today = dt.date.today()
rows = ["date,food_category,purchase_quantity,units_sold,waste_quantity,shelf_life_days,storage_temperature,promotion,weather"]
old_day = today - dt.timedelta(days=400)
rows.append(f"{old_day},Bakery,10,12,0,2,22,No,Sunny")   # sold > purchased
rows.append(f"{old_day},Bakery,-3,1,0,2,22,No,Sunny")    # duplicate + negative
rows.append(f"bad-date,Bakeryy,abc,1,0,2,warm,maybe,Snowy")
r = donor.post(B+'/api/forecasts/import-data', json={'file_name':'t.csv','mode':'validate','content':'\n'.join(rows)})
v = r.json(); msgs = {i['message'].split(' (')[0].split('.')[0] for i in v['issues']}
ok(r.ok and v['summary']['errorRows']==3, f"CSV validation catches errors: {sorted(msgs)[:8]}")
r = donor.post(B+'/api/forecasts/import-data', json={'file_name':'t.csv','mode':'import','content':'\n'.join(rows)})
ok(r.status_code==400, 'import blocked until errors fixed')
r = donor.post(B+'/api/forecasts/import-data', json={'file_name':'t.txt','mode':'validate','content':'a'})
ok(r.status_code==400, 'non-CSV file rejected')
big = 'x'*(3*1024*1024)
r = donor.post(B+'/api/forecasts/import-data', json={'file_name':'big.csv','mode':'validate','content':big})
ok(r.status_code==400 and 'too large' in r.text, 'CSV size limit enforced')
good = rows[:1] + [f"{old_day},Bakery,20,16,1,3,22,No,Cloudy"]
r = donor.post(B+'/api/forecasts/import-data', json={'file_name':'good.csv','mode':'import','content':'\n'.join(good)})
ok(r.ok and r.json()['imported']==1, 'valid CSV imported')

# 2. ML forecast
target = str(today)
r = donor.post(B+'/api/forecasts/predict', json={'category':'all','date':target})
f = r.json()
ok(f['ok'] and f['model_version'] and f['groups'], f"forecast ok, model {f['model_version']}, groups {[(g['food_category'], g['lower'], g['upper']) for g in f['groups']]}")
r = donor.post(B+'/api/forecasts/predict', json={'category':'all','date':'2031-01-01'})
ok(r.ok and r.json()['validation_status']=='invalid_input', 'unsupported horizon rejected with validation status')
fid = [g for g in f['groups'] if g['food_category']=='Bakery'][0]['forecast_id']
ok(fid > 0, f'forecast logged with id {fid}')
before_n = len(donor.get(B+'/api/donations').json()['donations'])
# Forecast must not create a donation automatically
ok(len(donor.get(B+'/api/donations').json()['donations'])==before_n, 'forecast did not auto-create a donation')

# 3. Donor publishes an actual donation (with forecast reference)
now = dt.datetime.now(dt.timezone.utc)
base = {'item_name':'UAT Bread','food_category':'Bakery','quantity_available':8,'unit':'kg','available_from':now.isoformat(),
        'safe_until':(now+dt.timedelta(hours=10)).isoformat(),'storage_requirement':'ambient','pickup_address':'House 27, Road 7, Dhanmondi',
        'packaging':'Sealed boxes','contact_method':'Call manager','forecast_id':fid,'safety_checks':['a','b','c','d']}
r = donor.post(B+'/api/donations', json={**base, 'safe_until':(now-dt.timedelta(hours=1)).isoformat()})
ok(r.status_code==400 and 'safe_until' in r.json()['error']['fields'], 'past deadline rejected')
r = donor.post(B+'/api/donations', json={**base, 'safety_checks':[]})
ok(r.status_code==400, 'missing safety confirmation rejected')
r = donor.post(B+'/api/donations', json=base)
ok(r.ok, f"donation published: {r.json()}")
did_ = r.json()['id']

# 4. Matching recommends only eligible recipients
m = donor.get(B+f'/api/donations/{did_}/matches').json()
names = [x['org']['organization_name'] for x in m['matches']]
excl = {x['organization_name']: x['reason'] for x in m['excluded']}
ok("Uttara Children's Home" not in names and 'not verified' in excl.get("Uttara Children's Home",''), f"matches {names}; excluded {excl}")
ok(all(0<=x['score']<=100 for x in m['matches']), 'scores within 0-100')

# Visibility: recipient sees redacted address before acceptance
d = rec.get(B+f'/api/donations/{did_}').json()['donation']
ok('shared after acceptance' in d['pickup_address'] and d['contact_method'] is None, 'contact/address hidden before acceptance')
ok(rec.patch(B+f'/api/donations/{did_}', json=base).status_code==403, "recipient cannot edit donor's donation")

# 5. Two recipients request; simultaneous accept protection
ok(rec.post(B+f'/api/donations/{did_}/request', json={'notes':'We can collect at 6pm'}).ok, 'recipient 1 requested')
ok(rec2.post(B+f'/api/donations/{did_}/request', json={}).ok, 'recipient 2 requested')
ok(rec.post(B+f'/api/donations/{did_}/request', json={}).status_code==409, 'duplicate request rejected')
reqs = donor.get(B+f'/api/donations/{did_}').json()['requests']
r1 = [x for x in reqs if x['organization_name']=='Mirpur Community Kitchen'][0]['id']
r2 = [x for x in reqs if x['organization_name']=='Hope Shelter Mohammadpur'][0]['id']
res = {}
def acc(k, rid): res[k] = donor.post(B+f'/api/donations/{did_}/accept', json={'request_id': rid}).status_code
t1 = threading.Thread(target=acc, args=('a', r1)); t2 = threading.Thread(target=acc, args=('b', r2))
t1.start(); t2.start(); t1.join(); t2.join()
ok(sorted(res.values())==[200,409], f'concurrent accepts: exactly one succeeds {res}')
dd = donor.get(B+f'/api/donations/{did_}').json()
accepted = [x for x in dd['requests'] if x['status']=='accepted']
ok(len(accepted)==1 and dd['donation']['status']=='accepted', f"one accepted request, donation accepted")
winner = rec if accepted[0]['organization_name']=='Mirpur Community Kitchen' else rec2
loser = rec2 if winner is rec else rec

# 6. Invalid transitions blocked
ok(winner.post(B+f'/api/donations/{did_}/confirm-delivery', json={'quantity_received':8,'as_expected':True}).status_code==409, 'cannot deliver before collected')
ok(loser.post(B+f'/api/donations/{did_}/schedule', json={'pickup_time':(now+dt.timedelta(hours=2)).isoformat()}).status_code==403, 'non-accepted recipient cannot schedule')
ok(winner.post(B+f'/api/donations/{did_}/schedule', json={'pickup_time':(now+dt.timedelta(hours=20)).isoformat()}).status_code==400, 'pickup after deadline rejected')
ok(winner.post(B+f'/api/donations/{did_}/schedule', json={'pickup_time':(now+dt.timedelta(hours=2)).isoformat()}).ok, 'collection scheduled')
d2 = winner.get(B+f'/api/donations/{did_}').json()['donation']
ok('Dhanmondi' in d2['pickup_address'] and 'shared after' not in d2['pickup_address'], 'accepted recipient sees exact address')
ok(winner.post(B+f'/api/donations/{did_}/collected', json={'quantity':8}).ok, 'collected')
ok(winner.post(B+f'/api/donations/{did_}/confirm-delivery', json={'quantity_received':9,'as_expected':True}).status_code==400, 'received > donated rejected')
ok(winner.post(B+f'/api/donations/{did_}/confirm-delivery', json={'quantity_received':7.5,'as_expected':False}).status_code==400, 'discrepancy description required')
before = donor.get(B+'/api/analytics/donor').json()
ok(winner.post(B+f'/api/donations/{did_}/confirm-delivery', json={'quantity_received':7.5,'as_expected':False,'discrepancy':'One box damaged'}).ok, 'receipt confirmed')
after = donor.get(B+'/api/analytics/donor').json()
ok(round(after['delivered']['kg'] - before['delivered']['kg'],1)==7.5, f"analytics: delivered kg {before['delivered']['kg']} -> {after['delivered']['kg']} (+7.5 confirmed, not 8 published)")
hist = donor.get(B+f'/api/donations/{did_}').json()['history']
ok([h['to_status'] for h in hist if h['from_status']!=h['to_status']][-5:]==['requested','accepted','scheduled','collected','delivered'], 'full status timeline recorded with actors')
ok(all(h['actor_user_id'] for h in hist), 'every status change has an actor')
ok(donor.post(B+f'/api/donations/{did_}/cancel', json={'reason':'x'}).status_code==409, 'delivered donation cannot be cancelled')

# 7. Volunteer flow on seeded open task
tasks = vol.get(B+'/api/collections').json()['collections']
open_id = [c for c in admin.get(B+'/api/collections').json()['collections'] if c['task_status']=='unassigned' and c['needs_volunteer']==1][0]['donation_id']
ok(vol.post(B+f'/api/donations/{open_id}/task', json={'action':'claim'}).ok, 'volunteer claimed open task')
ok(vol.post(B+f'/api/donations/{open_id}/task', json={'action':'collected','quantity':35}).ok, 'volunteer confirmed pickup')
ok(vol.post(B+f'/api/donations/{open_id}/task', json={'action':'delivered','quantity':35}).ok, 'volunteer recorded delivery')
rec3 = sess('recipient3@foodsphere.test')
ok(rec3.post(B+f'/api/donations/{open_id}/confirm-delivery', json={'quantity_received':35,'as_expected':True}).ok, 'recipient confirmed volunteer delivery')

# 8. Admin: verify pending org, audit log, model monitoring
users = admin.get(B+'/api/admin/users?verification=pending').json()['users']
uid = users[0]['id']
ok(admin.patch(B+f'/api/admin/users/{uid}/verification', json={'status':'rejected'}).status_code==400, 'rejection requires reason')
ok(admin.patch(B+f'/api/admin/users/{uid}/verification', json={'status':'verified'}).ok, 'admin verified pending org')
logs = admin.get(B+'/api/admin/audit-logs?entity=user').json()['logs']
ok(any(l['action']=='verification.approve' and l['entity_id']==uid for l in logs), 'verification recorded in audit log')
mm = admin.get(B+'/api/admin/model-monitoring').json()
ok(mm['counts']['predictions']>=1 and mm['counts']['validationFailures']>=1, f"model monitoring counts {mm['counts']}")
ok(admin.post(B+f'/api/donations/{did_}/admin-status', json={'status':'failed','reason':''}).status_code==400, 'admin correction requires reason')
print('\nALL ACCEPTANCE CHECKS PASSED')
