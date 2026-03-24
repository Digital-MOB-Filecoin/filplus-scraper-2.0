import { HttpService } from '@nestjs/axios';
import { AppConfig } from '../configuration/configuration.service';

export default async function extractDataFromGithubIssue(
  issueUrl: string,
  httpService: HttpService,
  config: AppConfig,
) {
  try {
    const apiIssueUrl = issueUrl.replace('github.com', 'api.github.com/repos');
    const getIssueReq = await httpService
      .get(apiIssueUrl, {
        auth: {
          username: config.values.github.user,
          password: config.values.github.token,
        },
      })
      .toPromise();

    const issue = getIssueReq.data.body;
    let re = new RegExp(`- Name:(.*)`, 'g');
    let nameArr = issue.match(re);
    let name = '';
    if (nameArr && nameArr[0]) {
      re = new RegExp(`^(- Name:)`);
      name = nameArr[0].replace(re, '');
    }

    if (!name) {
      re = new RegExp(`### Data Owner Name\r\n\r\n(.*)`, 'g');
      nameArr = issue.match(re);
      if (nameArr && nameArr[0]) {
        re = new RegExp(`^(### Data Owner Name\r\n\r\n)`);
        name = nameArr[0].replace(re, '');
      }
    }

    if (!name) {
      re = new RegExp(`### Data Owner Name\n\n(.*)`, 'g');
      nameArr = issue.match(re);
      if (nameArr && nameArr[0]) {
        re = new RegExp(`^(### Data Owner Name\n\n)`);
        name = nameArr[0].replace(re, '');
      }
    }

    if (!name) {
      re = new RegExp(`### Data Owner Name\r\n(.*)`, 'g');
      nameArr = issue.match(re);

      if (nameArr && nameArr[0]) {
        re = new RegExp(`^(### Data Owner Name\r\n)`);
        name = nameArr[0].replace(re, '');
      }
    }

    if (!name) {
      re = new RegExp(`### Data Owner Name\n(.*)`, 'g');
      nameArr = issue.match(re);

      if (nameArr && nameArr[0]) {
        re = new RegExp(`^(### Data Owner Name\n)`);
        name = nameArr[0].replace(re, '');
      }
    }

    re = new RegExp(`- Organization Name:(.*)`, 'g');
    let orgNameArr = issue.match(re);
    let orgName = '';
    if (orgNameArr && orgNameArr[0]) {
      re = new RegExp(`^(- Organization Name:)`);
      orgName = orgNameArr[0].replace(re, '');
    }

    if (!orgName) {
      re = new RegExp(`Affiliated organization:(.*)`, 'g');
      orgNameArr = issue.match(re);
      if (orgNameArr && orgNameArr[0]) {
        re = new RegExp(`^(Affiliated organization:)`);
        orgName = orgNameArr[0].replace(re, '');
      }
    }

    if (!orgName) {
      re = new RegExp(`Affiliated Organization:(.*)`, 'g');
      orgNameArr = issue.match(re);
      if (orgNameArr && orgNameArr[0]) {
        re = new RegExp(`^(Affiliated Organization:)`);
        orgName = orgNameArr[0].replace(re, '');
      }
    }
    name = name.replace(/[^a-zA-Z]/, '');
    orgName = orgName.replace(/[^a-zA-Z]/, '');

    let region = '';
    let industry = '';
    let website = '';
    let retrievalFrequency = '';
    let isDataPublic = '';

    re = new RegExp(
      `Confirm that this is a public dataset that can be retrieved by anyone on the Network\n\n(.*)`,
      'g',
    );
    const isDataPublicArr = issue.match(re);
    if (isDataPublicArr && isDataPublicArr[0]) {
      re = new RegExp(
        `^(Confirm that this is a public dataset that can be retrieved by anyone on the Network\n\n)`,
      );
      isDataPublic = isDataPublicArr[0].replace(re, '');
    }

    if (!isDataPublic) {
      re = new RegExp(
        `Confirm that this is a public dataset that can be retrieved by anyone on the Network \\(i\\.e\\.\\, no specific permissions or access rights are required to view the data\\)\\.\r\n\`\`\`\r\n(.*)`,
        'g',
      );
      const isDataPublicArr = issue.match(re);
      if (isDataPublicArr && isDataPublicArr[0]) {
        re = new RegExp(
          `^(Confirm that this is a public dataset that can be retrieved by anyone on the Network \\(i\\.e\\.\\, no specific permissions or access rights are required to view the data\\)\\.\r\n\`\`\`\r\n)`,
        );
        isDataPublic = isDataPublicArr[0].replace(re, '');
      }
    }
    isDataPublic = isDataPublic.toLowerCase();
    isDataPublic =
      isDataPublic.indexOf('yes') > -1 ||
        isDataPublic.indexOf('confirm') > -1 ||
        isDataPublic.indexOf('sure') > -1
        ? 'yes'
        : 'no';

    re = new RegExp(
      `What is the expected retrieval frequency for this data\n\n(.*)`,
      'g',
    );
    const retrievalFrequencyArr = issue.match(re);
    if (retrievalFrequencyArr && retrievalFrequencyArr[0]) {
      re = new RegExp(
        `^(What is the expected retrieval frequency for this data\n\n)`,
      );
      retrievalFrequency = retrievalFrequencyArr[0].replace(re, '');
    }

    if (!retrievalFrequency) {
      re = new RegExp(
        `What is the expected retrieval frequency for this data\\?\r\n\`\`\`\r\n(.*)`,
        'g',
      );
      const retrievalFrequencyArr = issue.match(re);
      if (retrievalFrequencyArr && retrievalFrequencyArr[0]) {
        re = new RegExp(
          `^(What is the expected retrieval frequency for this data\\?\r\n\`\`\`\r\n)`,
        );
        retrievalFrequency = retrievalFrequencyArr[0].replace(re, '');
      }
    }

    re = new RegExp(`Data Owner Country/Region\n\n(.*)`, 'g');
    const regionArr = issue.match(re);
    if (regionArr && regionArr[0]) {
      re = new RegExp(`^(Data Owner Country/Region\n\n)`);
      region = regionArr[0].replace(re, '');
    }

    // if (!region) {
    //   re = new RegExp(
    //     `In which geographies \\(countries, regions\\) do you plan on making storage deals\\?\r\n\`\`\`\r\n(.*)`,
    //     'g',
    //   );
    //   const regionArr = issue.match(re);
    //   if (regionArr && regionArr[0]) {
    //     re = new RegExp(
    //       `^(In which geographies \\(countries, regions\\) do you plan on making storage deals\\?\r\n\`\`\`\r\n)`,
    //     );
    //     region = regionArr[0].replace(re, '');
    //   }
    // }

    re = new RegExp(`Data Owner Industry\n\n(.*)`, 'g');
    const ownerArr = issue.match(re);
    if (ownerArr && ownerArr[0]) {
      re = new RegExp(`^(Data Owner Industry\n\n)`);
      industry = ownerArr[0].replace(re, '');
    }

    re = new RegExp(`Website\n\n(.*)`, 'g');
    const websiteArr = issue.match(re);
    if (websiteArr && websiteArr[0]) {
      re = new RegExp(`^(Website\n\n)`);
      website = websiteArr[0].replace(re, '');
    }

    if (!website) {
      re = new RegExp(`Website / Social Media:(.*)`, 'g');
      const websiteArr = issue.match(re);
      if (websiteArr && websiteArr[0]) {
        re = new RegExp(`^(Website / Social Media:)`);
        website = websiteArr[0].replace(re, '');
      }
    }

    let start = `### If you already have a list of storage providers to work with, fill out their names and provider IDs below`;
    let providerList = issue.split(start)[1];

    if (!providerList) {
      start = `### Please list the provider IDs and location of the storage providers you will be working with.`;
      providerList = issue.split(start)[1];
    }
    if (providerList) {
      const end = `###`;
      providerList = providerList.split(end)[0];

      if (providerList) {
        re = new RegExp(`f0[0-9]+`, 'g');
        providerList = providerList.match(re);
      } else {
        providerList = [];
      }
    } else {
      providerList = [];
    }

    console.log('fetched issue data: ', issueUrl);
    return {
      name,
      orgName,
      region,
      industry,
      website,
      retrievalFrequency,
      isDataPublic,
      providerList,
    };
  } catch (e) {
    console.log(`error fetching issue data: ${issueUrl}`);
    return {
      name: '',
      orgName: '',
      region: '',
      industry: '',
      website: '',
      retrievalFrequency: '',
      isDataPublic: '',
      providerList: [],
    };
  }
}
