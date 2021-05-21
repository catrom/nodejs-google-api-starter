import express from 'express'
import { google } from 'googleapis'
import { oauth2Client } from './auth'
import { downloadResource } from './utils'

const router = express.Router()
const googleAccounts = google.analytics('v3')
const googleAnalytics = google.analyticsreporting('v4')

router.get('/view', (req, res) => {
  const credentials = JSON.parse(req.cookies['tokens'])
  oauth2Client.setCredentials(credentials)

  googleAccounts.management.profiles.list(
    {
      accountId: '~all',
      webPropertyId: '~all',
      auth: oauth2Client
    },
    (err, profiles) => {
      if (err) {
        res.json({ success: 0, err: err.toString() })
      } else if (profiles) {
        let views = []
        profiles.data.items.forEach(({ id, webPropertyId, name, websiteUrl }) => {
          views.push({
            name: `${webPropertyId} - ${name} (${websiteUrl})`,
            id
          })
        })
        res.json({ success: 1, message: "Use a viewId as a request's query parameter to fetch Google Analytics data", views, profiles })
      }
    }
  )
})

// Get data formatted by schema:
// { timestamp, clientId, sessionId, location, gender, age, refer, url }
// ATTENTION: If a field is NULL, that row of data will not be listed by GA. So we have to consider to choose which fields should be queried together by comment/uncomment from the list below.

const queryListItems = [
  { label: 'Timestamp', value: 'dimensions[0]', dimensionName: 'ga:dimension1' },
  // { label: 'Session ID', value: 'Session ID', dimensionName: 'ga:dimension2' },
  // { label: 'Client ID', value: 'Client ID', dimensionName: 'ga:dimension3' },
  { label: 'Location', value: 'City', dimensionName: 'ga:city' },
  // { label: 'Gender', value: 'Gender', dimensionName: 'ga:userGender' },
  // { label: 'Age Bracket', value: 'Age Bracket', dimensionName: 'ga:userAgeBracket' },
  { label: 'Referral Path', value: 'Referral Path', dimensionName: 'ga:referralPath' },
  { label: 'URL', value: 'URL', dimensionName: 'ga:pagePath' },
]


router.get('/data', (req, res) => {
  const credentials = JSON.parse(req.cookies['tokens'])
  oauth2Client.setCredentials(credentials)

  // startDate, endDate should be in format: YYYY-MM-DD
  const { viewId, startDate, endDate } = req.query
  const dataFields = queryListItems.map((dimension, index) => ({ label: dimension.label, value: `dimensions[${index}]` }))
  const dimensionNameList = queryListItems.map(dimension => ({ name: dimension.dimensionName }))

  googleAnalytics.reports.batchGet({
    auth: oauth2Client,
    requestBody: {
      reportRequests: [
        {
          viewId,
          dateRanges: [
            { startDate: startDate || '7daysago', endDate: endDate || 'yesterday' }
          ],
          metrics: [
            { expression: "ga:users" },
          ],
          dimensions: dimensionNameList
        },
      ]
    }
  }, (err, payload) => {
    if (err) {
      res.json({ success: 0, err: err.toString() })
    } else {
      // res.json({ success: 1, payload })
      const fileName = 'GAreport_' + Date.now().toString() + '.csv'
      const data = payload.data.reports[0].data.rows
      downloadResource(res, fileName, dataFields, data)
    }
  })
})

export default router
