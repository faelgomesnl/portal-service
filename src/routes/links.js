const express = require('express');
const router = express.Router();
const path = require('path')

//anexar arquivo
const multer = require('multer');

const DIR = './uploads';

const storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, DIR);
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage
});



const pool = require('../database');
const {
    isLoggedIn
} = require('../lib/auth');

router.get('/add', isLoggedIn, (req, res) => {});

//ADICIONAR NOVO USUARIO, SOMENTE ADMIN
router.get('/newuser', isLoggedIn, (req, res) => {
    res.render('links/newuser')
});

router.post('/newuser', isLoggedIn, (req, res) => {
    const nomeusu = req.body.nomeusu;
    const senha = req.body.senha;
    const fullname = req.body.fullname;

    pool.query(`INSERT INTO sankhya.AD_TBLOGIN (NOMEUSU, SENHA, fullname) VALUES('${nomeusu}','${senha}','${fullname}')`);

    res.redirect('/links/allogin')
});

//ADICIONAR CONTRATOS AOS NOVOS USUÁRIOS, SOMENTE ADMIN
router.get('/newcont', isLoggedIn, async (req, res) => {

    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN 
    WHERE NOMEUSU NOT LIKE '%muffato%'
    AND NOMEUSU NOT LIKE '%.sgc%'
    AND NOMEUSU NOT LIKE '%.vmc%'
    AND NOMEUSU NOT LIKE '%@vectracs.com.br%'
    ORDER BY NOMEUSU `);

    //LISTAR CONTRATOS ATIVOS/ BONIFICADOS CDASTRADOS NA BASE
    const links2 = await pool.query(`SELECT DISTINCT 
    CON.NUMCONTRATO, 
    PAR.NOMEPARC   
        FROM sankhya.TCSCON CON 
        INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
        INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
        INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
        INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)   
        WHERE CON.ATIVO = 'S'  
        AND PS.SITPROD IN ('A','B')
        AND PD.USOPROD IN ('S', 'R')
        AND CON.CODEMP NOT IN (30,32) 
        AND CON.NUMCONTRATO <>0        
        ORDER BY CON.NUMCONTRATO`);

    res.render('links/newcont', {
        lista: links.recordset,
        cont: links2.recordset
    })
});


router.post('/newcont', isLoggedIn, async (req, res) => {

    const contrato = req.body.numcontrat;
    const login = req.body.login;

    pool.query(`INSERT INTO sankhya.AD_TBACESSO (NUM_CONTRATO, ID_LOGIN) VALUES('${contrato}','${login}')`);

    req.flash('success', 'O Contrato foi Vincunlado com Sucesso!!!!')
    res.redirect('/links/allogin')
});

//ADD OS
router.get('/orderserv', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN

    //contrato
    const links = await pool.query(`SELECT  L.NUM_CONTRATO, 
    CASE WHEN CON.AD_LOCALIDADE IS NULL THEN PAR.NOMEPARC
ELSE CON.AD_LOCALIDADE END AS NOMEPARC,
    PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,
    CON.AD_CIRCUITO,
    CD.NOMECID AS CIDADE,
    (CONVERT(VARCHAR(45),EN.NOMEEND,103)) as LOGRADOURO,
    CASE
         WHEN CON.AD_CODOCOROS IS NULL THEN 900
         ELSE CON.AD_CODOCOROS
       END AS CARTEIRA
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR PAR ON (PAR.CODPARC = CON.CODPARC) 
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    INNER JOIN sankhya.TGFCTT C ON (PAR.CODPARC=C.CODPARC)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TSIBAI BR ON (PAR.CODBAI=BR.CODBAI)
    LEFT JOIN sankhya.TSICID CD ON (CD.CODCID=PAR.CODCID)
    LEFT JOIN sankhya.TSIEND EN ON (EN.CODEND=PAR.CODEND)
    LEFT JOIN sankhya.TSIUFS UF ON (UF.UF=CD.UF)
    LEFT JOIN sankhya.TFPLGR LG ON (LG.CODLOGRADOURO=EN.CODLOGRADOURO)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD IN ('S', 'R')
    AND TC.PRIORIDADE IS NULL
    GROUP BY CON.AD_LOCALIDADE, L.NUM_CONTRATO,PAR.NOMEPARC,PAR.CODPARC,  CON.CODUSUOS , L.ID_LOGIN,    
    CON.AD_CIRCUITO,    CD.NOMECID, CON.AD_CODOCOROS,EN.NOMEEND
    ORDER BY CON.AD_LOCALIDADE`);

    //contatos
    const links2 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),c.CODCONTATO,103) as CONTATO,
    c.CODCONTATO AS CODCONT,
    UPPER  (CONVERT(VARCHAR(30),c.NOMECONTATO,103)) as NOME
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND CON.ATIVO = 'S'
    AND C.ATIVO = 'S'
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD='R'
    order by CONTATO`);

    //serviços
    const links3 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD='S'
    order by PRODUTO`);

    //produtos
    const links4 = await pool.query(`SELECT DISTINCT 
    UPPER  (CONVERT(VARCHAR(50),PD.DESCRPROD,120))+' - '+CONVERT(VARCHAR(30),con.NUMCONTRATO,103)+' -'+
    CONVERT(VARCHAR(30),PS.CODPROD,103) as PRODUTO,
    con.NUMCONTRATO,
     PD.DESCRPROD, 
     PS.CODPROD
    from sankhya.TGFPAR P
    INNER JOIN sankhya.TGFCTT C ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSCON CON ON (P.CODPARC = CON.CODPARC)
    inner join sankhya.AD_TBACESSO L ON (L.NUM_CONTRATO = CON.NUMCONTRATO)
    INNER JOIN sankhya.TCSPSC PS ON (CON.NUMCONTRATO=PS.NUMCONTRATO)
    INNER JOIN sankhya.TGFPRO PD ON (PD.CODPROD=PS.CODPROD)
    WHERE L.ID_LOGIN = ${idlogin}
    AND PS.SITPROD IN ('A','B')
    AND PD.USOPROD='R'
    order by PRODUTO`);

    res.render('links/testes', {
        geral: links.recordset,
        cont: links2.recordset,
        prod: links3.recordset,
        prod1: links4.recordset
    })
});

router.post('/orderserv', isLoggedIn, upload.single('file'), async (req, res) => {

    const links = await pool.query('select top (1) NUMOS +1 as NUMOS from sankhya.TCSOSE order by numos desc');
    const numos = Object.values(links.recordset[0])

    const texto = req.body.texto;
    const filetoupload = upload
    const contrato = req.body.contrato;
    const parceiro = req.body.codparc;
    const produto = req.body.codprod;
    const servico = req.body.codserv;
    const contato = req.body.atualiza;
    const cart = req.body.carteira;
    const uweb = req.body.usuweb;

    const t1 = texto
    const textofin = t1.replace("'", "`");

    //verificação cód prioridade sla
    const links2 = await pool.query(`SELECT DISTINCT 
    CASE WHEN CON.AD_CIRCUITO IS NULL
        THEN 
            CASE  WHEN (DATEPART(DW,GETDATE() )) = 7   
         THEN
                CASE 
                WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --add apenas 360
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
               
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
            
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE
                        
                
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))		
                END 
    
        --SLA DOMINGO
        WHEN (DATEPART(DW,GETDATE() )) = 1
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
                 
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
               
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
            
                WHEN 
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                    (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                                DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                ELSE
                        
                
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA TERÇA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 3
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA QUARTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 4
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA QUINTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 5
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        --SLA SEXTA-FEIRA
        WHEN (DATEPART(DW,GETDATE() )) = 6
        THEN
                CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 5, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 6, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
                END
    
        ELSE
    
            --SLA SEGUNDA-FEIRA
            --NO MESMO DIA
            CASE WHEN ((TC.VALORTEMPO/100)*60) < (ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0)) 
                --mesmo dia
                THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((TC.VALORTEMPO/100)*60), GETDATE()))
    
                --D+1
                WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=600
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 1, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
               --D+2
               WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=601 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1200
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-600) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 2, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))			
    
            --D+3
            WHEN 
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >=1201 AND
                (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) >= 0 and (((TC.VALORTEMPO/100)*60) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ) <=1800
                            THEN DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1200) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 3, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))	
            ELSE
                        
                --D+4
                DATEDIFF(MI, GETDATE(), DATEADD(MI, ((((TC.VALORTEMPO/100)*60)-1800) - ISNULL(DATEDIFF(MI,GETDATE(),convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.SAIDA, 2)+':'+RIGHT(CH.SAIDA, 2))),111)),0) ), 
                            DATEADD(DD, 4, convert(datetime,Concat(CONVERT(VARCHAR(10), CAST(getdate() AS DATETIME), 111),' ',(LEFT(CH.ENTRADA, 1)+':'+RIGHT(CH.ENTRADA, 2))),111))))
    
                END END
            
        ELSE       
        CASE WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42430 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42432 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42433 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42434 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42431 
            THEN ((TC.VALORTEMPO/100)*60)
    
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42435 
            THEN ((TC.VALORTEMPO/100)*60)
            
            WHEN CON.AD_CIRCUITO IS NOT NULL AND TC.PADRAO = 'N' AND TC.CODSERV = 42438 
            THEN ((TC.VALORTEMPO/100)*60)  
        END
    END
    
     AS VALORTEMPO 
    FROM sankhya.AD_TBACESSO L
    INNER JOIN sankhya.TCSCON CON ON (L.NUM_CONTRATO = CON.NUMCONTRATO)  
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = CON.NUSLA)
    LEFT JOIN sankhya.TCSRSL TC ON (SLA.NUSLA=TC.NUSLA)
    LEFT JOIN sankhya.TFPCGH TH ON (TH.CODCARGAHOR=SLA.CODCARGAHOR)  
    LEFT JOIN sankhya.TFPHOR CH ON (TH.CODCARGAHOR=CH.CODCARGAHOR)     
    WHERE CON.NUMCONTRATO='${contrato}'   
    AND (TC.CODSERV = '${produto}' OR TC.CODSERV IS NULL)
    AND CON.ATIVO = 'S'
    AND TC.PADRAO = (CASE WHEN CON.AD_CIRCUITO IS NOT NULL THEN 'N' ELSE 'S' END)
    AND CH.ENTRADA IS NOT NULL
    AND CH.SAIDA IS NOT NULL
`);
    const prioridade = Object.values(links2.recordset[0])
    var prioridadeFinal

    if (prioridade === '') {
        prioridadeFinal = 1440;
    } else {
        prioridadeFinal = prioridade;
    }
    //const prioridade = 1400

    await pool.query(`INSERT INTO sankhya.TCSOSE (NUMOS,NUMCONTRATO,DHCHAMADA,DTPREVISTA,CODPARC,CODCONTATO,CODATEND,CODUSURESP,DESCRICAO,SITUACAO,CODCOS,CODCENCUS,CODOAT,POSSUISLA) VALUES 
    ('${numos}','${contrato}',GETDATE(),(SELECT DATEADD(MI,${prioridadeFinal},GETDATE())),'${parceiro}','${contato}',110,110,'${textofin}','P','',30101,1000000,'S');
    INSERT INTO SANKHYA.TCSITE (NUMOS,NUMITEM,CODSERV,CODPROD,CODUSU,CODOCOROS,CODUSUREM,DHENTRADA,DHPREVISTA,CODSIT,COBRAR,RETRABALHO) VALUES 
    ('${numos}',1,'${produto}','${servico}','${uweb}','${cart}',110,GETDATE(),(SELECT DATEADD(MI,${prioridade},GETDATE())),15,'N','N')`);

    req.flash('success', 'Ordem De Serviço Criada com Sucesso!!!! Nº: ', numos)
    res.redirect('/links')

});

//PAGINAS DATATABLES
//LISTAR TODAS AS OS ABERTAS
router.get('/', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    I.NUMITEM,
    USU.NOMEUSU AS EXECUTANTE,
    FORMAT(O.DHCHAMADA , 'dd/MM/yyyy HH:mm:ss') AS ABERTURA,
    --CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,    
    /* CASE WHEN I.NUMITEM =1  THEN CONVERT(NVARCHAR(MAX),O.DESCRICAO)
    WHEN CONVERT(NVARCHAR(MAX),I.SOLUCAO) IS NULL  THEN CONVERT(NVARCHAR(MAX),O.DESCRICAO)
    ELSE CONVERT(NVARCHAR(MAX),I.SOLUCAO)  END AS DEFEITO , */
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO
    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN SANKHYA.TSIUSU USU ON (USU.CODUSU = I.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND I.TERMEXEC IS NULL
    --AND I.NUMITEM = (SELECT MAX(NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS AND TERMEXEC IS NULL)
    AND O.DHCHAMADA >= '01/01/2021'
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/list', {
        lista: links.recordset
    });
});

//LISTAR TODAS AS OS FECHADAS
router.get('/osclose', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    I.NUMITEM,
    CONVERT(VARCHAR(10), O.DHCHAMADA, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO,  
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND O.SITUACAO = 'F'
    AND I.NUMITEM = (SELECT DISTINCT MAX (NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/osclose', {
        lista: links.recordset
    });
});

//listar todas as OS registradas para o parceiro
router.get('/all', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS,
    (CASE O.SITUACAO WHEN 'F' THEN 'Fechada'ELSE 'Aberta' END) AS SITUACAO, 
    I.NUMITEM,
    CONVERT(VARCHAR(10), O.DHCHAMADA, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO,  
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    
    (CASE  WHEN O.SITUACAO ='P' THEN  '' ELSE I.SOLUCAO END )  AS SOLUCAO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAOA,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.AD_TBACESSO AC ON (C.NUMCONTRATO=AC.NUM_CONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND O.SITUACAO in ('P','F')
    AND I.NUMITEM = (SELECT DISTINCT MAX (NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND AC.ID_LOGIN= ${idlogin}`);
    res.render('links/all', {
        lista: links.recordset
    });
});

//listar todos os usuários (login) cadastrados
router.get('/allogin', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT CODLOGIN,fullname,NOMEUSU,ADMINISTRADOR
    FROM sankhya.AD_TBLOGIN`);
    res.render('links/allogin', {
        lista: links.recordset
    });
});

//remover parceiro
router.get('/delete/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    await pool.query(`DELETE FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    req.flash('success', 'Link Removed Successfully');
    res.redirect('/links');
});

//editar parceiro - exibição tela
router.get('/edit/:id', isLoggedIn, async (req, res) => {
    const {
        id
    } = req.params;
    const links = await pool.query(`SELECT * FROM sankhya.AD_TBPARCEIRO WHERE ID = ${id}`);
    res.render('links/edit', {
        lista: links.recordset[0]
    })
    /*//req.flash('success', 'Link Removed Successfully');
    res.redirect('/links'); */
});

//update
router.post('/edit/:id', async (req, res) => {
    const {
        id
    } = req.params;
    const nome = req.body.nome.substring(0, 100);
    const endereco = req.body.endereco.substring(0, 100);
    await pool.query(`UPDATE sankhya.AD_TBPARCEIRO set NOME=${nome} ENDERECO=${endereco} WHERE ID = ${id}`);
    res.redirect('/links');
});

//PERFIL ACESSO TÉCNICOS 
//listar todos os executantes vinculados portal/ sankhya
router.get('/tecnicos/allogin', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT NOMEUSU, AC.CODUSU, L.CODLOGIN
    FROM sankhya.AD_TBLOGIN L
    INNER JOIN sankhya.AD_ACESSOTEC AC ON (L.CODLOGIN = AC.CODLOGIN)
    WHERE AD_TECNICOSC = 1`);
    res.render('links/tecnicos/allogin', {
        lista: links.recordset
    });
});

//add novo técnico ao portal
router.get('/tecnicos/newtec', isLoggedIn, async (req, res) => {

    const links = await pool.query(`SELECT NOMEUSU, CODUSU, CODGRUPO
    FROM sankhya.TSIUSU
    WHERE DTLIMACESSO IS NULL
    AND CODGRUPO NOT IN (8,13)
    AND CODUSU NOT IN (411,0)
    ORDER BY NOMEUSU `);

    res.render('links/tecnicos/newtec', {
        lista: links.recordset
    })
});


router.post('/tecnicos/newtec', isLoggedIn, (req, res) => {
    const nomeusu = req.body.nomeusu;
    const codusu = req.body.codusu;
    const senha = req.body.senha;

    pool.query(`INSERT INTO sankhya.AD_TBLOGIN (NOMEUSU, SENHA, AD_TECNICOSC,fullname) VALUES('${nomeusu}','${senha}',1,'')`);
    res.redirect('/links/tecnicos/vincular')
});

//vincular técnico potal ao sankhya
router.get('/tecnicos/vincular', isLoggedIn, async (req, res) => {

    const links = await pool.query(`SELECT NOMEUSU,CODLOGIN
    FROM sankhya.AD_TBLOGIN 
    WHERE AD_TECNICOSC = 1 `);

    //LISTAR CONTRATOS ATIVOS/ BONIFICADOS CDASTRADOS NA BASE
    const links2 = await pool.query(`SELECT NOMEUSU, CODUSU
    FROM sankhya.TSIUSU
    WHERE DTLIMACESSO IS NULL
    AND CODGRUPO NOT IN (8,13)
    AND CODUSU NOT IN (411,0)
    ORDER BY NOMEUSU`);

    res.render('links/tecnicos/vincular', {
        lista: links.recordset,
        cont: links2.recordset
    })
});


router.post('/tecnicos/vincular', isLoggedIn, async (req, res) => {

    const codusuario = req.body.numcontrat;
    const login = req.body.login;

    pool.query(`INSERT INTO SANKHYA.AD_ACESSOTEC (CODUSU,CODLOGIN) VALUES ('${codusuario}','${login}')`);

    req.flash('success', 'Técnico Vincunlado com Sucesso!!!!')
    res.redirect('/links/tecnicos/allogin')
});

//PAGINAS DATATABLES 
//LISTAR TODAS AS OS ABERTAS
router.get('/tecnicos/abertas', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    I.NUMITEM,
    USU.NOMEUSU AS EXECUTANTE,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTPREVISTA,103)+' '+ CONVERT(VARCHAR(30),O.DTPREVISTA,108) AS PREVISAO,    
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO,
    ITS.DESCRICAO

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = I.CODUSU)
    INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
    INNER JOIN SANKHYA.TSIUSU USU ON (USU.CODUSU = I.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND I.TERMEXEC IS NULL
    --AND I.NUMITEM = (SELECT MAX(NUMITEM) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS AND TERMEXEC IS NULL)   
    AND L.CODLOGIN= ${idlogin}`);
    res.render('links/tecnicos/abertas', {
        lista: links.recordset
    });
});

//LISTAR TODAS AS OS FECHADAS
router.get('/tecnicos/fechadas', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const links = await pool.query(`SELECT 
    C.NUMCONTRATO, 
    P.NOMEPARC,    
    O.NUMOS, 
    I.NUMITEM,
    CONVERT(VARCHAR(10), O.DHCHAMADA, 120)  AS ABERTURA2,
    CONVERT(VARCHAR(30),O.DHCHAMADA,103)+' '+ CONVERT(VARCHAR(30),O.DHCHAMADA,108) AS ABERTURA,
    CONVERT(VARCHAR(30),O.DTFECHAMENTO,103)+' '+ CONVERT(VARCHAR(30),O.DTFECHAMENTO,108) AS DT_FECHAMENTO,
    CONVERT(VARCHAR(30),I.TERMEXEC,103)+' '+ CONVERT(VARCHAR(30),I.TERMEXEC,108) AS DT_EXECUCAO,  
    CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO,
    CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO,
    U.NOMEUSU AS RESPONSAVEL,
    USU.NOMEUSU AS EXECUTANTE,
    TSIUSU.NOMEUSU AS FECHADA,

    CID.NOMECID AS CIDADE,
    UFS.UF,
    SLA.DESCRICAO AS DESCRICAO_SLA,
    O.AD_MOTIVO_OI AS MOTIVO,
    O.AD_SOLICITANTE_OI AS SOLICITANTE,
    AD_TIPO_OI AS TIPO

    FROM sankhya.TCSOSE O
    INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
    INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
    INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
    INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
    INNER JOIN sankhya.TSIUSU     ON (TSIUSU.CODUSU = O.CODUSUFECH)
    INNER JOIN sankhya.TSIUSU USU ON (USU.CODUSU = I.CODUSU)
    INNER JOIN sankhya.TSIUSU U ON (O.CODUSURESP=U.CODUSU)

    LEFT JOIN SANKHYA.TCSITS ITS ON (ITS.CODSIT = I.CODSIT)
    LEFT JOIN SANKHYA.TGFCPL CPL ON (P.CODPARC = CPL.CODPARC)
    LEFT JOIN SANKHYA.TSICID CID ON (CPL.CODCIDENTREGA = CID.CODCID)
    LEFT JOIN SANKHYA.TSIUFS UFS ON (CID.UF = UFS.CODUF)
    LEFT JOIN sankhya.TCSSLA SLA ON (SLA.NUSLA = C.NUSLA)

    WHERE 
    O.NUFAP IS NULL
    AND O.SITUACAO = 'F'
    AND I.TERMEXEC = (SELECT DISTINCT MAX (TERMEXEC) FROM SANKHYA.TCSITE WHERE NUMOS = O.NUMOS)
    --AND O.DHCHAMADA >= DATEADD(DAY, -60, GETDATE())
    AND L.CODLOGIN= ${idlogin}`);
    res.render('links/tecnicos/fechadas', {
        lista: links.recordset
    });
});

//TELA SALVAR ITEM OS 
router.get('/tecnicos/salvar_os/:texto?', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const params = req.params.texto;
    const numos = params

    //OS SELECIONADA TÉCNICO PARA SALVAR 
    const links = await pool.query(`SELECT O.NUMOS,I.NUMITEM, CONVERT(NVARCHAR(MAX),O.DESCRICAO)AS DEFEITO, 
    I.CODPROD,I.CODSERV, AC.CODUSU AS CODUSUREM, CONVERT(NVARCHAR(MAX),I.SOLUCAO) AS SOLUCAO
    FROM sankhya.TCSOSE O
        INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
        INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
        INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
        INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = I.CODUSU)
        INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
    WHERE 
        O.NUFAP IS NULL
        AND I.TERMEXEC IS NULL
        AND L.CODLOGIN = ${idlogin}
        AND I.NUMOS =${numos}
    GROUP BY O.NUMOS,I.NUMITEM,CONVERT(NVARCHAR(MAX),O.DESCRICAO),I.CODPROD,I.CODSERV,AC.CODUSU,CONVERT(NVARCHAR(MAX),I.SOLUCAO)`);

    const links2 = await pool.query(`SELECT I.NUMOS, TC.CODUSUREL, U.NOMEUSU, U.CODUSU
        FROM sankhya.TCSITE I
            INNER JOIN sankhya.TCSRUS TC ON (I.CODUSU=TC.CODUSU)
            INNER JOIN sankhya.TSIUSU U ON (TC.CODUSUREL = U.CODUSU)
            INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = I.CODUSU)
            INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
            LEFT JOIN sankhya.TGFSEU SE ON (SE.CODUSU = U.CODUSU)
            LEFT JOIN sankhya.TGFPRO P ON (I.CODPROD = P.CODPROD)
            LEFT JOIN sankhya.TGFPRO S ON (I.CODSERV = S.CODPROD)
            LEFT JOIN sankhya.TGFSEU SER ON (SER.CODSERV = S.CODPROD)
        WHERE NUMOS = ${numos}
        AND L.CODLOGIN =${idlogin}
        AND SE.CODPROD =(SELECT SE.CODPROD
            FROM sankhya.TGFSEU SE
                INNER JOIN sankhya.TCSRUS US ON (SE.CODUSU=US.CODUSUREL)
                INNER JOIN sankhya.TCSITE IT ON (SE.CODPROD=IT.CODPROD)
            WHERE SE.CODUSU = U.CODUSU
                AND IT.NUMOS = I.NUMOS
            GROUP BY SE.CODPROD)
        AND SE .CODSERV = (SELECT SE.CODSERV
                    FROM sankhya.TGFSEU SE
                        INNER JOIN sankhya.TCSRUS US ON (SE.CODUSU=US.CODUSUREL)
                        INNER JOIN sankhya.TCSITE IT ON (SE.CODSERV=IT.CODSERV)
                    WHERE SE.CODUSU = U.CODUSU
                        AND IT.NUMOS = I.NUMOS
                    GROUP BY SE.CODSERV)
        GROUP BY TC.CODUSUREL, U.NOMEUSU, I.NUMOS, U.CODUSU
        ORDER BY U.NOMEUSU`);

    const links3 = await pool.query(`SELECT DISTINCT I.CODOCOROS
    FROM sankhya.TCSOSE O
        INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)        
        INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
        INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = I.CODUSU)
        INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
    WHERE 
         I.NUMOS =${numos}        
        AND I.NUMITEM = 1`);

    const links4 = await pool.query(`SELECT CD.DESCROCOROS, CD.CODOCOROS
    FROM sankhya.TCSOOS CD
    INNER JOIN sankhya.TCSSEM E ON (CD.CODOCOROS=E.CODOCOROS)
    INNER JOIN sankhya.TCSITE I ON (I.CODOCOROS=CD.CODOCOROS)
    WHERE E.CODPROD = (SELECT DISTINCT CODSERV
    FROM  sankhya.TCSITE
    WHERE NUMOS = ${numos} AND NUMITEM =1)
    GROUP BY CD.DESCROCOROS, CD.CODOCOROS
    ORDER BY DESCROCOROS`);

    const links5 = await pool.query(`SELECT I.CODSIT, IT.DESCRICAO
    FROM sankhya.TCSOSE O
        INNER JOIN sankhya.TCSCON C ON (C.NUMCONTRATO=O.NUMCONTRATO)
        INNER JOIN sankhya.TGFPAR P ON (P.CODPARC=C.CODPARC)
        INNER JOIN sankhya.TCSITE I ON (O.NUMOS=I.NUMOS)
        INNER JOIN sankhya.TCSITS IT ON (IT.CODSIT=I.CODSIT)
        INNER JOIN sankhya.AD_ACESSOTEC AC ON (AC.CODUSU = I.CODUSU)
        INNER JOIN sankhya.AD_TBLOGIN L ON (L.CODLOGIN=AC.CODLOGIN)
    --WHERE 
            --L.CODLOGIN = ${idlogin}
        --AND I.NUMOS =${numos}
    GROUP BY I.CODSIT, IT.DESCRICAO
    ORDER BY IT.DESCRICAO`);

    const links6 = await pool.query(`SELECT COUNT (I.NUMITEM) AS ABERTAS
    FROM sankhya.TCSITE I
    WHERE
    I.TERMEXEC IS NULL
        AND I.NUMOS =${numos} 
        AND I.NUMITEM <> (SELECT MAX(NUMITEM) FROM sankhya.TCSITE WHERE NUMOS = ${numos} )`);

    pool.query(`UPDATE sankhya.AD_TBLOGIN SET ULTIMO_ACESSO = GETDATE() WHERE CODLOGIN= ${idlogin}`);

    res.render('links/tecnicos/salvar_os', {
        geral: links.recordset,
        cont: links2.recordset,
        item: links3.recordset,
        motivo: links4.recordset,
        statusit: links5.recordset,
        fechar: links6.recordset
    });
});

router.post('/tecnicos/salvar_os', isLoggedIn, async (req, res) => {

    const codusuario = req.body.value;
    const prioridade = req.body.prioridade;
    const motivo = req.body.motivo;
    const statusit = req.body.statusi;
    const dataex = req.body.dte;
    const horai = req.body.hi;
    const horaf = req.body.hf;
    const solucao = req.body.solucao;
    const numos = req.body.numos;
    const numitem = req.body.numitem;

    //CONCATENAR DATA E HORA PARA ADD CAMPO TERMEXEC 
    const links1 = await pool.query(`select '${dataex}' +' '+'${horaf}'`);
    const tremexec = Object.values(links1.recordset[0])

    //REMOVER : CAMPO HORA 
    const rm1 = horai
    const horai1 = rm1.replace(":", "");
    const rm2 = horaf
    const horaf1 = rm2.replace(":", "");
    const t1 = solucao
    const textofin = t1.replace("'", "`");

    pool.query(`UPDATE sankhya.TCSITE
    SET CODUSU =${codusuario} ,PRIORIDADE =${prioridade} ,SOLUCAO ='${textofin}' ,CODOCOROS=${motivo} ,
    CODSIT=${statusit} ,HRINICIAL=${horai1} ,HRFINAL=${horaf1} ,INICEXEC= '${dataex}',TERMEXEC = '${tremexec}'
    WHERE NUMOS =${numos} 
        AND NUMITEM =${numitem}`);

    req.flash('success', 'Ordem De Serviço Salva com Sucesso!!!!')
    res.redirect('/links/tecnicos/abertas')
});

router.post('/tecnicos/encaminhar_os', isLoggedIn, async (req, res) => {

    const codusuario = req.body.value;
    const motivo = req.body.motivo;
    const prioridade = req.body.prioridade;
    const statusit = req.body.statusi;
    const dataex = req.body.dte;
    const horai = req.body.hi;
    const horaf = req.body.hf;
    const solucao = req.body.solucao;
    const numos = req.body.numos;
    const nitem = req.body.numitem;
    const codprod = req.body.codprod;
    const codserv = req.body.codserv;
    const codusurem = req.body.codusurem;

    //CONCATENAR DATA E HORA PARA ADD CAMPO TERMEXEC 
    const links1 = await pool.query(`select '${dataex}' +' '+'${horaf}'`);
    const tremexec = Object.values(links1.recordset[0])

    //REMOVER : CAMPO HORA 
    const rm1 = horai
    const horai1 = rm1.replace(":", "");
    const rm2 = horaf
    const horaf1 = rm2.replace(":", "");
    const t1 = solucao
    const textofin = t1.replace("'", "`");

    //GERA O NOVO ITEM A SER INSERIDO NA OS 
    const item = await pool.query(`select top (1) NUMITEM +1 as NUMOS from sankhya.TCSITE WHERE NUMOS = ${numos} order by numos desc`);
    const numitem = Object.values(item.recordset[0])

    //VALIDA CAMPO TEMPOPREVISTO NA TABELA TCSITE 
    const tempop = await pool.query(`SELECT convert(varchar, DHPREVISTA,  101) FROM sankhya.TCSITE WHERE NUMOS = ${numos} AND NUMITEM = ${nitem}`);
    const tprevisto = Object.values(tempop.recordset[0])

    pool.query(`UPDATE sankhya.TCSITE
    SET CODUSU =${codusuario} ,PRIORIDADE =${prioridade} ,SOLUCAO ='${textofin}' ,CODOCOROS=${motivo} ,
    CODSIT=${statusit} ,HRINICIAL=${horai1} ,HRFINAL=${horaf1} ,INICEXEC= '${dataex}',TERMEXEC = '${tremexec}'
    WHERE NUMOS =${numos} 
        AND NUMITEM =${nitem};

    INSERT INTO sankhya.TCSITE (NUMOS,NUMITEM, DHPREVISTA, CODUSU,SOLUCAO, CODOCOROS , TEMPPREVISTO,DTALTER,CODUSUALTER,CODUSUREM ,
        DHENTRADA, CODSIT ,DHLIMITESLA,CODSERV,CODPROD)
        VALUES (${numos}, ${numitem}, '${dataex}', ${codusuario}, '${textofin}', ${motivo}, ${tprevisto}, GETDATE(), ${codusurem}, ${codusurem}, 
        GETDATE(), ${statusit}, GETDATE(),${codserv}, ${codprod})`);

    req.flash('success', 'Ordem De Serviço Encaminhada com Sucesso!!!!')
    res.redirect('/links/tecnicos/abertas')
});

router.post('/tecnicos/fechar_os', isLoggedIn, async (req, res) => {

    const codusuario = req.body.value;
    const prioridade = req.body.prioridade;
    const motivo = req.body.motivo;
    const statusit = req.body.statusi;
    const dataex = req.body.dte;
    const horai = req.body.hi;
    const horaf = req.body.hf;
    const solucao = req.body.solucao;
    const numos = req.body.numos;
    const numitem = req.body.numitem;

    //CONCATENAR DATA E HORA PARA ADD CAMPO TERMEXEC 
    const links1 = await pool.query(`select '${dataex}' +' '+'${horaf}'`);
    const tremexec = Object.values(links1.recordset[0])

    //REMOVER : CAMPO HORA 
    const rm1 = horai
    const horai1 = rm1.replace(":", "");
    const rm2 = horaf
    const horaf1 = rm2.replace(":", "");
    const t1 = solucao
    const textofin = t1.replace("'", "`");


    pool.query(`UPDATE sankhya.TCSITE
    SET CODUSU =${codusuario}, SOLUCAO ='${textofin}', CODOCOROS=${motivo}, CODSIT=${statusit}, HRINICIAL=${horai1},
        HRFINAL=${horaf1}, INICEXEC= GETDATE(), TERMEXEC = GETDATE()
    WHERE NUMOS =${numos} AND NUMITEM =${numitem};
    
    UPDATE SANKHYA.TCSOSE 
    SET SITUACAO = 'F', DTFECHAMENTO = GETDATE(), CODUSUFECH = ${codusuario}, DHFECHAMENTOSLA = GETDATE()
    WHERE NUMOS =${numos}`);

    req.flash('success', 'Ordem De Serviço Finalizada com Sucesso!!!!')
    res.redirect('/links/tecnicos/abertas')
});

//update
//ADICIONAR CONTRATOS AOS NOVOS USUÁRIOS, SOMENTE ADMIN
router.get('/password', isLoggedIn, async (req, res) => {
    res.render('links/passwords')
});

//update
//ATUALIZAR SENHA DO USUÁRIO
router.post('/password', isLoggedIn, async (req, res) => {
    const idlogin = req.user.CODLOGIN
    const contrato = req.body.contrato;
    pool.query(`UPDATE sankhya.AD_TBLOGIN
            SET SENHA = '${contrato}'
            WHERE CODLOGIN = '${idlogin}'`);

    req.flash('success', 'Senha atualizada com Sucesso!!!!')
    res.redirect('/links/tecnicos/abertas')
});

module.exports = router;